import { useCallback, useState } from "react";
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

interface ParticipantResult {
  title: string | null;
  name: string;
  email: string | null;
  rawPhone: string | null;
  countryCode: string | null;
  phone: string | null;
}

interface SkippedResult {
  title: string | null;
  name: string;
  email: string | null;
  rawPhone: string | null;
}

interface ErrorResult {
  participant: {
    title: string | null;
    name: string;
    email: string | null;
    rawPhone: string | null;
  };
  reason: string;
}

interface ImportResultData {
  created: ParticipantResult[];
  skipped: SkippedResult[];
  overwritten: ParticipantResult[];
  merged: ParticipantResult[];
  errors: ErrorResult[];
}

interface Props {
  eventId: string;
  resultId: string;
  onClose: () => void;
}

export default function ImportResultDialog({
  eventId,
  resultId,
  onClose,
}: Props) {
  const api = useApi();
  const [open, setOpen] = useState(true);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose();
  }, [onClose]);

  const resultQuery = useQuery<ImportResultData>({
    queryKey: ["importResult", eventId, resultId],
    queryFn: () => api.get(`/api/events/${eventId}/importResult/${resultId}`),
    enabled: open,
  });

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
                            <TableCell>{a.title ?? "—"}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>
                              {a.countryCode && a.phone
                                ? `${a.countryCode} ${a.phone}`
                                : "—"}
                            </TableCell>
                            <TableCell>{a.email ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            )}

            {data.overwritten.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="info.main">
                    <Chip
                      label={data.overwritten.length}
                      color="info"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Overwritten
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
                        {data.overwritten.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell>{a.title ?? "—"}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>
                              {a.countryCode && a.phone
                                ? `${a.countryCode} ${a.phone}`
                                : "—"}
                            </TableCell>
                            <TableCell>{a.email ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            )}

            {data.merged.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" color="primary.main">
                    <Chip
                      label={data.merged.length}
                      color="primary"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    Merged
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
                        {data.merged.map((a, i) => (
                          <TableRow key={i}>
                            <TableCell>{a.title ?? "—"}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>
                              {a.countryCode && a.phone
                                ? `${a.countryCode} ${a.phone}`
                                : "—"}
                            </TableCell>
                            <TableCell>{a.email ?? "—"}</TableCell>
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
                            <TableCell>{a.title ?? "—"}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{a.rawPhone ?? "—"}</TableCell>
                            <TableCell>{a.email ?? "—"}</TableCell>
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
                            <TableCell>{e.participant.title ?? "—"}</TableCell>
                            <TableCell>{e.participant.name}</TableCell>
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
              data.overwritten.length === 0 &&
              data.merged.length === 0 &&
              data.skipped.length === 0 &&
              data.errors.length === 0 && (
                <Typography color="textSecondary">
                  No participants were processed.
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
