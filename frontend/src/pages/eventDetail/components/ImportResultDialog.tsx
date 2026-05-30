import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../../../api";

interface AttendeeResult {
  title: string;
  name: string;
  email: string;
  rawPhone: string;
  countryCode: string;
  phone: string;
}

interface SkippedResult {
  title: string;
  name: string;
  email: string;
  rawPhone: string;
}

interface ErrorResult {
  attendee: {
    title: string;
    name: string;
    email: string;
    rawPhone: string;
  };
  reason: string;
}

interface ImportResultData {
  created: AttendeeResult[];
  skipped: SkippedResult[];
  errors: ErrorResult[];
}

interface Props {
  eventId: string;
  resultId: string;
  expireOn: string;
  onClose: () => void;
}

export default function ImportResultDialog({
  eventId,
  resultId,
  expireOn,
  onClose,
}: Props) {
  const api = useApi();
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  }, [onClose]);

  const resultQuery = useQuery<ImportResultData>({
    queryKey: ["importResult", eventId, resultId],
    queryFn: () => api.get(`/api/events/${eventId}/importResult/${resultId}`),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const remaining = new Date(expireOn).getTime() - Date.now();
    if (remaining <= 0) {
      timerRef.current = setTimeout(handleClose, 0);
      return;
    }
    timerRef.current = setTimeout(handleClose, remaining);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [expireOn, open, handleClose]);

  const data = resultQuery.data;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Result</DialogTitle>
      <DialogContent dividers>
        {resultQuery.isLoading && <LinearProgress />}

        {data && (
          <Stack spacing={3}>
            {data.created.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="success.main">
                    <Chip
                      label={data.created.length}
                      color="success"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Created
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell>Email</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.created.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell>{a.title}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>
                              {a.countryCode} {a.phone}
                            </TableCell>
                            <TableCell>{a.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            )}

            {data.skipped.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="warning.main">
                    <Chip
                      label={data.skipped.length}
                      color="warning"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Skipped (duplicate)
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell>Email</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.skipped.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell>{a.title}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{a.rawPhone}</TableCell>
                            <TableCell>{a.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            )}

            {data.errors.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="error.main">
                    <Chip
                      label={data.errors.length}
                      color="error"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Errors
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Title</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {data.errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell>{e.attendee.title}</TableCell>
                            <TableCell>{e.attendee.name}</TableCell>
                            <TableCell>{e.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            )}

            {data.created.length === 0 &&
              data.skipped.length === 0 &&
              data.errors.length === 0 && (
                <Typography color="text.secondary">
                  No attendees were processed.
                </Typography>
              )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Dismiss</Button>
      </DialogActions>
    </Dialog>
  );
}
