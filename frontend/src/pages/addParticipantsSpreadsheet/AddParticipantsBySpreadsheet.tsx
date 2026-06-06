import { useCallback, useRef, useState } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
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
  Typography,
} from "@mui/material";
import ConflictDialog from "@/components/ConflictDialog";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ApiError, useApi } from "../../api";
import TabIcon from "@mui/icons-material/Tab";

const PARTICIPANT_FIELDS = [
  "(Ignore)",
  "Title",
  "Name",
  "Phone",
  "Email",
] as const;
type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];

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

interface SpreadsheetImportRequest {
  taskId: string;
  sheetName: string;
  strategy: string;
  nameMatchMode: string;
  rowMapping: RowMapping;
}

export default function AddParticipantsBySpreadsheet() {
  const { eventId } = useParams({
    from: "/app-shell/events/$eventId/addParticipantsBySpreadsheet",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [strategy, setStrategy] = useState("skip");
  const [nameMatchMode, setNameMatchMode] = useState("exact");

  const importMutation = useMutation({
    mutationFn: async (payload: SpreadsheetImportRequest) => {
      await api.post(`/api/events/${eventId}/spreadsheetImport`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictDetail(typeof err.detail === "string" ? err.detail : null);
      }
    },
  });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
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
        setUploadError(
          "Failed to upload or parse the file. Ensure it is a valid Excel or CSV file.",
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
    });
  };

  const isImportDisabled = !getMappingAssignment("Name");

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{eventName}</Typography>

      <Typography variant="h5">Add Participants from Spreadsheet</Typography>

      <Stepper activeStep={activeStep}>
        <Step>
          <StepLabel>Upload spreadsheet</StepLabel>
        </Step>
        <Step>
          <StepLabel>Select sheet</StepLabel>
        </Step>
        <Step>
          <StepLabel>Map columns to participants' details</StepLabel>
        </Step>
      </Stepper>

      {uploadError && <Typography color="error">{uploadError}</Typography>}

      {activeStep === 0 && (
        <Stack spacing={2}>
          <Box
            sx={{
              p: 6,
              textAlign: "center",
              width: "100%",
              maxWidth: 400,
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 1,
              cursor: uploading ? "wait" : "pointer",
              opacity: uploading ? 0.6 : 1,
              pointerEvents: uploading ? "none" : "auto",
              "&:hover": uploading
                ? {}
                : { borderColor: "primary.main", bgcolor: "action.hover" },
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <CircularProgress size={40} sx={{ mb: 1 }} />
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Uploading and analysing file...
                </Typography>
              </>
            ) : (
              <>
                <CloudUploadIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Click to select a spreadsheet
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block" }}
                >
                  Supports .xlsx, .csv
                </Typography>
              </>
            )}
          </Box>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            hidden
            onChange={handleFileChange}
          />
        </Stack>
      )}

      {activeStep === 1 && preview && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            There're multiple sheets in your uploaded file. Choose the one that
            has the data you want to import!
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
                  <Typography variant="body2" color="text.secondary">
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
            <strong>{selectedSheet}</strong> - Use the dropdown to map your
            spreadsheet columns to corresponding participant information. The
            first 5 data entries are shown for preview.
          </Typography>

          <Stack spacing={2}>
            <FormControl>
              <Typography variant="subtitle2" gutterBottom>
                Duplicate handling strategy
              </Typography>
              <RadioGroup
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <FormControlLabel
                  value="skip"
                  control={<Radio />}
                  label="Skip (Recommended)"
                />
                <FormControlLabel
                  value="overwrite"
                  control={<Radio />}
                  label="Overwrite"
                />
                <FormControlLabel
                  value="smartMerge"
                  control={<Radio />}
                  label="Smart Merge"
                />
              </RadioGroup>
            </FormControl>

            <FormControl>
              <Typography variant="subtitle2" gutterBottom>
                Name matching mode
              </Typography>
              <Select
                value={nameMatchMode}
                onChange={(e) => setNameMatchMode(e.target.value)}
                size="small"
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="exact">Exact Match</MenuItem>
                <MenuItem value="fuzzy">Fuzzy Match</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {preview.sheets[selectedSheet].columns.length > 0 ? (
            <>
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
                                      {f}
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
              <Box>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  loading={importMutation.isPending}
                  disabled={isImportDisabled}
                >
                  Import Participants
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              This sheet is empty.
            </Typography>
          )}
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
