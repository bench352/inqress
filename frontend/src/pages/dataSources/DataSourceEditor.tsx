import { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import TabIcon from "@mui/icons-material/Tab";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "@/api.ts";
import DataHandlingStep from "@/components/DataHandlingStep";
import {
  PARTICIPANT_FIELDS,
  type ParticipantField,
} from "@/components/participantFields";
import type {
  DataSourceHeader,
  DataSourceResponse,
  SheetPreview,
} from "./types";

interface PreviewResponse {
  sheets: Record<string, SheetPreview>;
}

function initialMapping(source?: DataSourceResponse) {
  const mapping: Record<string, ParticipantField> = {};
  if (!source) return mapping;
  if (source.titleColumn) mapping[source.titleColumn] = "Title";
  if (source.nameColumn) mapping[source.nameColumn] = "Name";
  if (source.rawPhoneColumn) mapping[source.rawPhoneColumn] = "Phone";
  if (source.emailColumn) mapping[source.emailColumn] = "Email";
  return mapping;
}

function isConflictDetail(
  detail: unknown,
): detail is { code: string; message: string } {
  return (
    typeof detail === "object" &&
    detail !== null &&
    "code" in detail &&
    "message" in detail
  );
}

function DataSourceEditorForm({
  eventId,
  source,
}: {
  eventId: string;
  source?: DataSourceResponse;
}) {
  const isEdit = !!source;
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState(source?.name ?? "");
  const [url, setUrl] = useState(source?.url ?? "");
  const [headers, setHeaders] = useState<DataSourceHeader[]>(
    source?.headers ?? [],
  );
  const [sheets, setSheets] = useState<Record<string, SheetPreview> | null>(
    null,
  );
  const [selectedSheet, setSelectedSheet] = useState<string | null>(
    source?.sheetName ?? null,
  );
  const [columnMapping, setColumnMapping] = useState<
    Record<string, ParticipantField>
  >(initialMapping(source));
  const [tracking, setTracking] = useState<string>(source?.tracking ?? "match");
  const [strategy, setStrategy] = useState(source?.strategy ?? "smartMerge");
  const [nameMatchMode, setNameMatchMode] = useState(
    source?.nameMatchMode ?? "exact",
  );
  const [activateNew, setActivateNew] = useState(source?.activateNew ?? true);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);
  const [nameConflictError, setNameConflictError] = useState<string | null>(
    null,
  );
  const [linkStepSubmitted, setLinkStepSubmitted] = useState(false);
  const nameError = linkStepSubmitted && !name.trim();
  const urlError = linkStepSubmitted && !url.trim();

  const columns = selectedSheet ? (sheets?.[selectedSheet]?.columns ?? []) : [];

  const keepSheetColumns = useCallback(
    (sheetName: string, preview: Record<string, SheetPreview>) => {
      const sheetColumns = preview[sheetName]?.columns ?? [];
      setColumnMapping((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([column]) =>
            sheetColumns.includes(column),
          ),
        ),
      );
    },
    [],
  );

  const fetchPreview = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const data = await api.post<PreviewResponse>(
        `/api/events/${eventId}/dataSourcePreview`,
        { url, headers },
      );
      setSheets(data.sheets);
      const sheetNames = Object.keys(data.sheets);
      if (sheetNames.length === 1) {
        setSelectedSheet(sheetNames[0]);
        keepSheetColumns(sheetNames[0], data.sheets);
        setActiveStep(2);
      } else {
        setActiveStep(1);
      }
    } catch (err) {
      setFetchError(
        err instanceof ApiError && typeof err.detail === "string"
          ? err.detail
          : "Failed to read the file at this link.",
      );
    } finally {
      setFetching(false);
    }
  }, [api, eventId, url, headers, keepSheetColumns]);

  const handleNext = () => {
    setLinkStepSubmitted(true);
    if (!name.trim() || !url.trim()) return;
    void fetchPreview();
  };

  const getMappingAssignment = (field: ParticipantField): string | null => {
    if (field === "(Ignore)") return null;
    return (
      Object.entries(columnMapping).find(([, f]) => f === field)?.[0] ?? null
    );
  };

  const handleColumnMappingChange = (
    columnName: string,
    field: ParticipantField,
  ) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (field !== "(Ignore)") {
        Object.keys(next)
          .sort()
          .forEach((col) => {
            if (next[col] === field && col !== columnName) {
              next[col] = "(Ignore)";
            }
          });
      }
      next[columnName] = field;
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: (clearRowLinks: boolean) => {
      const payload = {
        name,
        headers,
        sheetName: selectedSheet,
        tracking,
        strategy: tracking === "row" ? null : strategy,
        nameMatchMode: tracking === "row" ? null : nameMatchMode,
        activateNew,
        titleColumn: getMappingAssignment("Title"),
        nameColumn: getMappingAssignment("Name"),
        rawPhoneColumn: getMappingAssignment("Phone"),
        emailColumn: getMappingAssignment("Email"),
      };
      if (source) {
        return api.put<DataSourceResponse>(
          `/api/events/${eventId}/dataSources/${source.id}`,
          { ...payload, clearRowLinks },
        );
      }
      return api.post<DataSourceResponse>(
        `/api/events/${eventId}/dataSources`,
        { ...payload, url },
      );
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["dataSources", eventId] });
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      if (saved?.syncSkipped) {
        enqueueSnackbar(
          "Saved. Another import is running, so this sync was skipped and will run on the next cycle.",
          { variant: "info" },
        );
      } else {
        enqueueSnackbar(isEdit ? "Data source saved" : "Data source added", {
          variant: "success",
        });
      }
      navigate({
        to: "/admin/events/$eventId/dataSources",
        params: { eventId },
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        if (isConflictDetail(err.detail)) {
          if (err.detail.code === "duplicate_name") {
            setNameConflictError(err.detail.message);
            setActiveStep(0);
            return;
          }
          setConflictDetail(err.detail.message);
          return;
        }
        setConflictDetail(typeof err.detail === "string" ? err.detail : null);
        return;
      }
      enqueueSnackbar(
        err instanceof ApiError && typeof err.detail === "string"
          ? err.detail
          : "Failed to save the data source",
        { variant: "error" },
      );
    },
  });

  const nameMapped = !!getMappingAssignment("Name");
  const canSave = nameMapped && (!!sheets || isEdit);

  return (
    <Stack spacing={3}>
      <Typography variant="h5">
        {isEdit ? `Edit data source: ${source?.name}` : "Add data source"}
      </Typography>

      <Stepper activeStep={activeStep}>
        <Step>
          <StepLabel>Link</StepLabel>
        </Step>
        <Step>
          <StepLabel>Select sheet</StepLabel>
        </Step>
        <Step>
          <StepLabel>Map columns to participant details</StepLabel>
        </Step>
        <Step>
          <StepLabel>Choose how data is handled</StepLabel>
        </Step>
      </Stepper>

      {activeStep === 0 && (
        <Stack spacing={2}>
          <Typography variant="body1">
            Paste a link that downloads the file directly, for example a Google
            Sheets CSV export or any URL that returns a .csv or .xlsx file. A
            sharing or "view" link that returns a web page cannot be read.
          </Typography>

          <TextField
            label="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameConflictError(null);
            }}
            fullWidth
            required
            error={nameError || !!nameConflictError}
            helperText={
              nameError ? "Name is required" : (nameConflictError ?? " ")
            }
          />

          <TextField
            label="Link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            fullWidth
            required
            disabled={isEdit}
            error={urlError}
            helperText={
              isEdit
                ? "The link cannot be changed after the data source is created."
                : urlError
                  ? "Link is required"
                  : " "
            }
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
          />

          <Stack spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Request headers (optional)
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Static headers sent with every fetch, if the file host requires
              one.
            </Typography>
            {headers.map((header, index) => (
              <Stack key={index} direction="row" spacing={1}>
                <TextField
                  label="Header name"
                  size="small"
                  value={header.name}
                  onChange={(e) =>
                    setHeaders((prev) =>
                      prev.map((h, i) =>
                        i === index ? { ...h, name: e.target.value } : h,
                      ),
                    )
                  }
                />
                <TextField
                  label="Value"
                  size="small"
                  value={header.value}
                  onChange={(e) =>
                    setHeaders((prev) =>
                      prev.map((h, i) =>
                        i === index ? { ...h, value: e.target.value } : h,
                      ),
                    )
                  }
                />
                <IconButton
                  aria-label="Remove header"
                  onClick={() =>
                    setHeaders((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  <CloseIcon />
                </IconButton>
              </Stack>
            ))}
            <Box>
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  setHeaders((prev) => [...prev, { name: "", value: "" }])
                }
              >
                Add header
              </Button>
            </Box>
          </Stack>

          {fetchError && <Alert severity="error">{fetchError}</Alert>}
          {isEdit && !sheets && (
            <Alert severity="info">
              Press Next to reload the columns. Saving without checking keeps
              the current column mapping.
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() =>
                navigate({
                  to: "/admin/events/$eventId/dataSources",
                  params: { eventId },
                })
              }
            >
              Back
            </Button>
            <Button variant="contained" loading={fetching} onClick={handleNext}>
              Next
            </Button>
          </Stack>
        </Stack>
      )}

      {activeStep === 1 && sheets && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            There are multiple sheets in this file. Choose the one that has the
            data to sync.
          </Typography>
          {Object.keys(sheets).map((sheetName) => {
            const sheet = sheets[sheetName];
            return (
              <Paper
                key={sheetName}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() => {
                  setSelectedSheet(sheetName);
                  if (sheets) keepSheetColumns(sheetName, sheets);
                  setActiveStep(2);
                }}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <TabIcon />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {sheetName}
                  </Typography>
                </Stack>
                {sheet.columns.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {sheet.columns.map((col) => (
                            <TableCell key={col} sx={{ fontWeight: 600 }}>
                              {col}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sheet.heads.map((row, ri) => (
                          <TableRow key={ri}>
                            {sheet.columns.map((_, ci) => (
                              <TableCell key={ci}>{row[ci] ?? ""}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body1" color="textSecondary">
                    (empty sheet)
                  </Typography>
                )}
              </Paper>
            );
          })}
          <Box>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              Back
            </Button>
          </Box>
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            <strong>{selectedSheet}</strong> — Use the dropdown to map your
            columns to participant information. The first 5 data entries are
            shown for preview.
          </Typography>

          {columns.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {(() => {
                      const usedFields = new Set(
                        Object.values(columnMapping).filter(
                          (f) => f !== "(Ignore)",
                        ),
                      );
                      return columns.map((col) => {
                        const assigned = columnMapping[col] || "(Ignore)";
                        return (
                          <TableCell
                            key={col}
                            sx={{ verticalAlign: "top", pb: 1 }}
                          >
                            <Select
                              value={assigned}
                              onChange={(
                                ev: SelectChangeEvent<ParticipantField>,
                              ) =>
                                handleColumnMappingChange(
                                  col,
                                  ev.target.value as ParticipantField,
                                )
                              }
                              size="small"
                              sx={{ minWidth: 100 }}
                            >
                              {PARTICIPANT_FIELDS.map((f) => (
                                <MenuItem
                                  key={f}
                                  value={f}
                                  disabled={
                                    f !== "(Ignore)" &&
                                    f !== assigned &&
                                    usedFields.has(f)
                                  }
                                >
                                  {f === "Name" ? "Name *" : f}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                        );
                      });
                    })()}
                  </TableRow>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 600, pt: 1 }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(sheets?.[selectedSheet ?? ""]?.heads ?? []).map(
                    (row, ri) => (
                      <TableRow key={ri}>
                        {columns.map((_, ci) => (
                          <TableCell key={ci}>{row[ci] ?? ""}</TableCell>
                        ))}
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="warning">
              This sheet has no columns, so the column mapping cannot be changed
              now. The saved column mapping is kept.
            </Alert>
          )}

          {!nameMapped && (
            <Alert severity="warning">Map a column to Name to continue.</Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() =>
                setActiveStep(sheets && Object.keys(sheets).length > 1 ? 1 : 0)
              }
            >
              Back
            </Button>
            <Button
              variant="contained"
              disabled={!nameMapped}
              onClick={() => setActiveStep(3)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      )}

      {activeStep === 3 && (
        <Stack spacing={3}>
          <DataHandlingStep
            strategy={strategy}
            onStrategyChange={setStrategy}
            nameMatchMode={nameMatchMode}
            onNameMatchModeChange={setNameMatchMode}
            activateNew={activateNew}
            onActivateNewChange={setActivateNew}
            tracking={tracking}
            onTrackingChange={setTracking}
          />

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => setActiveStep(2)}>
              Back
            </Button>
            <Button
              variant="contained"
              loading={saveMutation.isPending}
              disabled={!canSave}
              onClick={() => saveMutation.mutate(false)}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      )}

      <Dialog open={!!conflictDetail} onClose={() => setConflictDetail(null)}>
        <DialogTitle>Drop the saved row links?</DialogTitle>
        <DialogContent>
          <Typography>{conflictDetail}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictDetail(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setConflictDetail(null);
              saveMutation.mutate(true);
            }}
          >
            Drop row links and save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default function DataSourceEditor() {
  const { eventId, sourceId } = useParams({ strict: false }) as {
    eventId: string;
    sourceId?: string;
  };
  const api = useApi();

  const eventQuery = useQuery<{ name: string }>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });

  const sourceQuery = useQuery<DataSourceResponse>({
    queryKey: ["dataSource", eventId, sourceId],
    queryFn: () => api.get(`/api/events/${eventId}/dataSources/${sourceId}`),
    enabled: !!eventId && !!sourceId,
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{eventQuery.data?.name ?? "..."}</Typography>

      {sourceId && sourceQuery.isError ? (
        <Alert severity="error">This data source no longer exists.</Alert>
      ) : sourceId && !sourceQuery.data ? (
        <Typography variant="body1" color="textSecondary">
          Loading...
        </Typography>
      ) : (
        <DataSourceEditorForm eventId={eventId} source={sourceQuery.data} />
      )}
    </Stack>
  );
}
