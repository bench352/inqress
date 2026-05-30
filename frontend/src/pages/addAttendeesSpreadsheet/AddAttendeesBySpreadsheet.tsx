import { useCallback, useRef, useState } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ApiError, useApi } from "../../api";
import TabIcon from "@mui/icons-material/Tab";

const ATTENDEE_FIELDS = [
  "(Ignore)",
  "Title",
  "Name",
  "Phone",
  "Email",
] as const;
type AttendeeField = (typeof ATTENDEE_FIELDS)[number];

interface SheetPreview {
  columns: string[];
  heads: string[][];
}

interface ExcelPreviewResponse {
  taskId: string;
  expireIn: string;
  sheetNames: string[];
  sheets: Record<string, SheetPreview>;
}

interface RowMapping {
  titleColumn?: string | null;
  nameColumn?: string | null;
  rawPhoneColumn?: string | null;
  emailColumn?: string | null;
}

interface ExcelImportRequest {
  taskId: string;
  sheetName: string;
  rowMapping: RowMapping;
}

export default function AddAttendeesBySpreadsheet() {
  const location = useLocation();
  const eventId = location.pathname.split("/").filter(Boolean)[1];
  const navigate = useNavigate();
  const api = useApi();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventQuery = useQuery<{ name: string }>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
  });
  const eventName = eventQuery.data?.name ?? "...";

  const [activeStep, setActiveStep] = useState(0);
  const [preview, setPreview] = useState<ExcelPreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Record<string, AttendeeField>
  >({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: async (payload: ExcelImportRequest) => {
      await api.post(`/api/events/${eventId}/excelImport`, payload);
    },
    onSuccess: () => {
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictDetail(err.detail);
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
        const data = await api.postFormData<ExcelPreviewResponse>(
          `/api/events/${eventId}/excelPreview`,
          formData,
        );
        setPreview(data);
        if (data.sheetNames.length === 1) {
          setSelectedSheet(data.sheetNames[0]);
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
    field: AttendeeField,
  ) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (field !== "(Ignore)") {
        Object.keys(next).forEach((col) => {
          if (next[col] === field && col !== columnName) {
            next[col] = "(Ignore)";
          }
        });
      }
      next[columnName] = field;
      return next;
    });
  };

  const getMappingAssignment = (field: AttendeeField): string | null => {
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
      rowMapping,
    });
  };

  const isImportDisabled =
    !getMappingAssignment("Title") ||
    !getMappingAssignment("Name") ||
    !getMappingAssignment("Phone") ||
    !getMappingAssignment("Email");

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{eventName}</Typography>

      <Typography variant="h5">Add Attendees from Spreadsheet</Typography>

      <Stepper activeStep={activeStep}>
        <Step>
          <StepLabel>Upload spreadsheet</StepLabel>
        </Step>
        <Step>
          <StepLabel>Select sheet</StepLabel>
        </Step>
        <Step>
          <StepLabel>Map columns to attendees' details</StepLabel>
        </Step>
      </Stepper>

      {uploadError && <Typography color="error">{uploadError}</Typography>}

      {activeStep === 0 && (
        <Stack spacing={2} alignItems="center">
          <Box
            onClick={() => !uploading && fileInputRef.current?.click()}
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
          >
            {uploading ? (
              <>
                <CircularProgress size={40} sx={{ mb: 1 }} />
                <Typography variant="body1" sx={{ mb: 1 }}>
                  Uploading and parsing file...
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

      {activeStep === 1 && preview && preview.sheetNames.length > 1 && (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            There're multiple sheets in your uploaded file. Choose the one that
            has the data you want to import!
          </Typography>
          {preview.sheetNames.map((name) => {
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
            spreadsheet columns to corresponding attendee information. The first
            5 data entrires are shown for preview.
          </Typography>
          {preview.sheets[selectedSheet].columns.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {preview.sheets[selectedSheet].columns.map((col) => {
                        const assigned = columnMapping[col] || "(Ignore)";
                        const usedFields = new Set(
                          Object.values(columnMapping).filter(
                            (f) => f !== "(Ignore)",
                          ),
                        );
                        return (
                          <TableCell
                            key={col}
                            sx={{ verticalAlign: "top", pb: 1 }}
                          >
                            <Select
                              value={assigned}
                              onChange={(
                                ev: SelectChangeEvent<AttendeeField>,
                              ) =>
                                handleColumnMappingChange(
                                  col,
                                  ev.target.value as AttendeeField,
                                )
                              }
                              size="small"
                              sx={{ minWidth: 100 }}
                            >
                              {ATTENDEE_FIELDS.map((f) => (
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
                      })}
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
                  Import Attendees
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

      <Dialog open={!!conflictDetail} onClose={() => setConflictDetail(null)}>
        <DialogTitle>Import in progress</DialogTitle>
        <DialogContent>
          <DialogContentText>{conflictDetail}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConflictDetail(null)}>Dismiss</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
