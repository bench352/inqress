import { useCallback, useState } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ConflictDialog from "@/components/ConflictDialog";
import DataHandlingStep from "@/components/DataHandlingStep";
import FileUploadField from "@/components/FileUploadField";
import PageHeader from "@/components/PageHeader";
import ResponsiveStepper from "@/components/ResponsiveStepper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ApiError, useApi } from "@/api.ts";
import TabIcon from "@mui/icons-material/Tab";
import {
  PARTICIPANT_FIELDS,
  type ParticipantField,
} from "@/components/participantFields";

interface SheetPreview {
  columns: string[];
  heads: string[][];
}

interface SpreadsheetPreviewResponse {
  taskId: string;
  expireIn: string;
  sheets: Record<string, SheetPreview>;
}

interface RowMapping {
  titleColumn?: string | null;
  nameColumn?: string | null;
  rawPhoneColumn?: string | null;
  emailColumn?: string | null;
}

const STEPS = [
  "Upload the file",
  "Pick a sheet",
  "Match columns to person details",
  "Choose what happens to duplicates",
];

interface SpreadsheetImportRequest {
  taskId: string;
  sheetName: string;
  strategy: string;
  nameMatchMode: string;
  rowMapping: RowMapping;
  activateNew: boolean;
}

export default function AddParticipantsBySpreadsheet() {
  const { eventId } = useParams({
    from: "/app-shell/admin/events/$eventId/addParticipantsBySpreadsheet",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();

  const eventQuery = useQuery<{ name: string }>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });
  const eventName = eventQuery.data?.name ?? "...";

  const [activeStep, setActiveStep] = useState(0);
  const [preview, setPreview] = useState<SpreadsheetPreviewResponse | null>(
    null,
  );
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Record<string, ParticipantField>
  >({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);
  const [strategy, setStrategy] = useState("smartMerge");
  const [nameMatchMode, setNameMatchMode] = useState("exact");
  const [activateNew, setActivateNew] = useState(true);

  const importMutation = useMutation({
    mutationFn: async (payload: SpreadsheetImportRequest) => {
      await api.post(`/api/events/${eventId}/spreadsheetImport`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      navigate({ to: "/admin/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictDetail(typeof err.detail === "string" ? err.detail : null);
      }
    },
  });

  const handleFileSelect = useCallback(
    async (file: File) => {
      setColumnMapping({});
      setUploading(true);
      setUploadError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const data = await api.postFormData<SpreadsheetPreviewResponse>(
          `/api/events/${eventId}/spreadsheetPreview`,
          formData,
        );
        setPreview(data);
        const sheetNames = Object.keys(data.sheets);
        if (sheetNames.length === 1) {
          setSelectedSheet(sheetNames[0]);
          setActiveStep(2);
        } else {
          setActiveStep(1);
        }
      } catch {
        setUploadError("The file could not be read. Use an Excel or CSV file.");
      } finally {
        setUploading(false);
      }
    },
    [eventId, api],
  );

  const handleSheetSelect = (sheetName: string) => {
    setColumnMapping({});
    setSelectedSheet(sheetName);
    setActiveStep(2);
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

  const getMappingAssignment = (field: ParticipantField): string | null => {
    if (field === "(Ignore)") return null;
    return (
      Object.entries(columnMapping).find(([, f]) => f === field)?.[0] ?? null
    );
  };

  const handleImport = () => {
    if (!preview || !selectedSheet) return;
    const rowMapping: RowMapping = {};
    const titleCol = getMappingAssignment("Title");
    const nameCol = getMappingAssignment("Name");
    const phoneCol = getMappingAssignment("Phone");
    const emailCol = getMappingAssignment("Email");
    if (titleCol) rowMapping.titleColumn = titleCol;
    if (nameCol) rowMapping.nameColumn = nameCol;
    if (phoneCol) rowMapping.rawPhoneColumn = phoneCol;
    if (emailCol) rowMapping.emailColumn = emailCol;
    importMutation.mutate({
      taskId: preview.taskId,
      sheetName: selectedSheet,
      strategy,
      nameMatchMode,
      rowMapping,
      activateNew,
    });
  };

  const isImportDisabled = !getMappingAssignment("Name");

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Import from a spreadsheet"
        subtitle={eventName}
        onBack={() =>
          navigate({ to: "/admin/events/$eventId", params: { eventId } })
        }
      />

      <ResponsiveStepper steps={STEPS} activeStep={activeStep} />

      {uploadError && <Alert severity="error">{uploadError}</Alert>}

      {activeStep === 0 && (
        <FileUploadField
          accept=".xlsx,.csv"
          formats="Excel (.xlsx) or CSV"
          prompt="Drop a spreadsheet here, or click to browse"
          onFileSelect={handleFileSelect}
          loading={uploading}
          loadingText="Uploading and analysing file…"
        />
      )}

      {activeStep === 1 && preview && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            There are multiple sheets in your uploaded file. Choose the one that
            has the data you want to import.
          </Typography>
          {Object.keys(preview.sheets).map((name) => {
            const sheet = preview.sheets[name];
            return (
              <Paper
                key={name}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: "action.hover",
                  },
                }}
                onClick={() => handleSheetSelect(name)}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "center",
                  }}
                >
                  <TabIcon />
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {name}
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
        </Stack>
      )}

      {activeStep === 2 && preview && selectedSheet && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            <strong>{selectedSheet}</strong> — Use the dropdown to map your
            spreadsheet columns to corresponding participant information. The
            first 5 data entries are shown for preview.
          </Typography>

          {preview.sheets[selectedSheet].columns.length > 0 ? (
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
                      return preview.sheets[selectedSheet].columns.map(
                        (col) => {
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
                        },
                      );
                    })()}
                  </TableRow>
                  <TableRow>
                    {preview.sheets[selectedSheet].columns.map((col) => (
                      <TableCell key={col} sx={{ fontWeight: 600, pt: 1 }}>
                        {col}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.sheets[selectedSheet].heads.map((row, ri) => (
                    <TableRow key={ri}>
                      {preview.sheets[selectedSheet].columns.map((_, ci) => (
                        <TableCell key={ci}>{row[ci] ?? ""}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body1" color="textSecondary">
              This sheet is empty.
            </Typography>
          )}

          {isImportDisabled && (
            <Alert severity="warning">Map a column to Name to continue.</Alert>
          )}

          <Box>
            <Button
              variant="contained"
              onClick={() => setActiveStep(3)}
              disabled={isImportDisabled}
            >
              Next
            </Button>
          </Box>
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
          />

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => setActiveStep(2)}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleImport}
              loading={importMutation.isPending}
            >
              Import participants
            </Button>
          </Stack>
        </Stack>
      )}

      <ConflictDialog
        open={!!conflictDetail}
        title="Import in progress"
        detail={conflictDetail}
        onClose={() => setConflictDetail(null)}
      />
    </Stack>
  );
}
