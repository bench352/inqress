import { useRef, useState } from "react";
import {
  Box,
  Button,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "@/api.ts";
import ConflictDialog from "@/components/ConflictDialog";
import DataHandlingStep from "@/components/DataHandlingStep";

const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

interface ParticipantInput {
  key: number;
  title: string;
  name: string;
  email: string;
  rawPhone: string;
}

export default function AddParticipantsManually() {
  const { eventId } = useParams({
    from: "/app-shell/events/$eventId/addParticipantsManually",
  });
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const api = useApi();
  const queryClient = useQueryClient();
  const nextKeyRef = useRef(1);

  function newRow(): ParticipantInput {
    const key = nextKeyRef.current++;
    return {
      key,
      title: "Mr.",
      name: "",
      email: "",
      rawPhone: "",
    };
  }

  const eventQuery = useQuery<{ name: string }>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });
  const eventName = eventQuery.data?.name ?? "...";

  const [activeStep, setActiveStep] = useState(0);
  const [rows, setRows] = useState<ParticipantInput[]>([
    { key: 0, title: "Mr.", name: "", email: "", rawPhone: "" },
  ]);
  const [rowErrors, setRowErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);
  const [strategy, setStrategy] = useState("smartMerge");
  const [nameMatchMode, setNameMatchMode] = useState("exact");

  const mutation = useMutation({
    mutationFn: async (
      payload: Array<{
        title: string | null;
        name: string;
        email: string | null;
        rawPhone: string | null;
      }>,
    ) => {
      await api.post(`/api/events/${eventId}/participants`, {
        strategy,
        nameMatchMode,
        data: payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictDetail(typeof err.detail === "string" ? err.detail : null);
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to add participants";
        enqueueSnackbar(message, { variant: "error" });
      }
    },
  });

  const updateRow = (
    key: number,
    field: keyof ParticipantInput,
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  };

  const clearRowError = (key: number, field: string) => {
    setRowErrors((prev) => {
      if (!prev[key]) return prev;
      const rowErr = { ...prev[key] };
      delete rowErr[field];
      if (Object.keys(rowErr).length === 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: rowErr };
    });
  };

  const deleteRow = (key: number) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [newRow()] : next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, newRow()]);
  };

  const validateRows = (): boolean => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;
    for (const row of rows) {
      const rowErr: Record<string, string> = {};
      if (!row.name.trim()) {
        rowErr.name = "Name is required";
        hasErrors = true;
      }
      if (Object.keys(rowErr).length > 0) newErrors[row.key] = rowErr;
    }
    setRowErrors(newErrors);
    return !hasErrors;
  };

  const handleSubmit = () => {
    if (!validateRows()) return;
    const payload = rows.map(({ title, name, email, rawPhone }) => ({
      title: title || null,
      name,
      email: email || null,
      rawPhone: rawPhone || null,
    }));
    mutation.mutate(payload);
  };

  const hasValidationError = Object.keys(rowErrors).length > 0;

  const hasAnyField = rows.some(
    (r) => r.title || r.name || r.email || r.rawPhone,
  );

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{eventName}</Typography>

      <Typography variant="h5">Add Participants Manually</Typography>

      <Stepper activeStep={activeStep}>
        <Step>
          <StepLabel>Enter participant information</StepLabel>
        </Step>
        <Step>
          <StepLabel>Choose how data is handled</StepLabel>
        </Step>
      </Stepper>

      {activeStep === 0 && (
        <Stack spacing={2}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 100 }}>Title</TableCell>
                  <TableCell>Name *</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Select
                        value={row.title}
                        onChange={(e) =>
                          updateRow(row.key, "title", e.target.value)
                        }
                        size="small"
                        fullWidth
                      >
                        {TITLE_OPTIONS.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.name}
                        onChange={(e) => {
                          updateRow(row.key, "name", e.target.value);
                          clearRowError(row.key, "name");
                        }}
                        error={!!rowErrors[row.key]?.name}
                        size="small"
                        fullWidth
                        placeholder="Name *"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.email}
                        onChange={(e) => {
                          updateRow(row.key, "email", e.target.value);
                          clearRowError(row.key, "email");
                        }}
                        error={!!rowErrors[row.key]?.email}
                        size="small"
                        fullWidth
                        placeholder="Optional"
                        type="email"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={row.rawPhone}
                        onChange={(e) => {
                          updateRow(row.key, "rawPhone", e.target.value);
                          clearRowError(row.key, "phone");
                        }}
                        error={!!rowErrors[row.key]?.phone}
                        size="small"
                        fullWidth
                        placeholder="Optional"
                        type="tel"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => deleteRow(row.key)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Button
            startIcon={<AddIcon />}
            onClick={addRow}
            variant="outlined"
            size="small"
            sx={{ alignSelf: "flex-start" }}
          >
            Add Row
          </Button>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button
              variant="contained"
              onClick={() => {
                if (validateRows()) {
                  setActiveStep(1);
                }
              }}
              disabled={!hasAnyField}
            >
              Next
            </Button>
            {hasValidationError && (
              <Typography variant="body2" color="error">
                Complete the required fields
              </Typography>
            )}
          </Box>
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={3}>
          <DataHandlingStep
            strategy={strategy}
            onStrategyChange={setStrategy}
            nameMatchMode={nameMatchMode}
            onNameMatchModeChange={setNameMatchMode}
          />

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              loading={mutation.isPending}
            >
              Submit
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
