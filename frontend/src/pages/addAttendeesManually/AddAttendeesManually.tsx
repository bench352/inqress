import { useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
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
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "../../api";
import ConflictDialog from "@/components/ConflictDialog";

const TITLE_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

interface AttendeeInput {
  key: number;
  title: string;
  name: string;
  email: string;
  rawPhone: string;
}

export default function AddAttendeesManually() {
  const { eventId } = useParams({
    from: "/app-shell/events/$eventId/addAttendeesManually",
  });
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const api = useApi();
  const queryClient = useQueryClient();
  const nextKeyRef = useRef(0);

  function newRow(): AttendeeInput {
    return {
      key: ++nextKeyRef.current,
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

  // eslint-disable-next-line react-hooks/refs -- Counter ref used for generating unique list keys
  const [rows, setRows] = useState<AttendeeInput[]>(() => {
    const key = ++nextKeyRef.current;
    return [{ key, title: "Mr.", name: "", email: "", rawPhone: "" }];
  });
  const [rowErrors, setRowErrors] = useState<
    Record<number, Record<string, string>>
  >({});
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (
      payload: Array<{
        title: string;
        name: string;
        email: string;
        rawPhone: string;
      }>,
    ) => {
      await api.post(`/api/events/${eventId}/attendees`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflictDetail(err.detail);
      } else {
        const message =
          err instanceof Error ? err.message : "Failed to add attendees";
        enqueueSnackbar(message, { variant: "error" });
      }
    },
  });

  const updateRow = (
    key: number,
    field: keyof AttendeeInput,
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

  const handleSubmit = () => {
    const newErrors: Record<number, Record<string, string>> = {};
    let hasErrors = false;
    for (const row of rows) {
      const rowErr: Record<string, string> = {};
      if (!row.name.trim()) {
        rowErr.name = "Name is required";
        hasErrors = true;
      }
      if (!row.email.trim()) {
        rowErr.email = "Email is required";
        hasErrors = true;
      }
      if (!row.rawPhone.trim()) {
        rowErr.phone = "Phone is required";
        hasErrors = true;
      }
      if (Object.keys(rowErr).length > 0) newErrors[row.key] = rowErr;
    }
    setRowErrors(newErrors);
    if (hasErrors) return;

    const payload = rows.map(({ title, name, email, rawPhone }) => ({
      title,
      name,
      email,
      rawPhone,
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

      <Typography variant="h5">Add Attendees Manually</Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 100 }}>Title</TableCell>
              <TableCell>Name</TableCell>
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
                    placeholder="Name"
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
                    placeholder="Email"
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
                    placeholder="Phone"
                    type="tel"
                  />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => deleteRow(row.key)}>
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
          onClick={handleSubmit}
          loading={mutation.isPending}
          disabled={!hasAnyField}
        >
          Submit
        </Button>
        {hasValidationError && (
          <Typography variant="body2" color="error">
            Complete the required fields
          </Typography>
        )}
      </Box>

      <ConflictDialog
        open={!!conflictDetail}
        title="Import in progress"
        detail={conflictDetail}
        onClose={() => setConflictDetail(null)}
      />
    </Stack>
  );
}
