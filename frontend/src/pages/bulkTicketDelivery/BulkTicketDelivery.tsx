import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
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
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SendIcon from "@mui/icons-material/Send";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ConflictDialog from "@/components/ConflictDialog";
import DOMPurify from "dompurify";
import { ApiError, useApi } from "../../api";
import { useAppInfo } from "@/providers/useAppInfo";
import type { ParticipantItem } from "../eventDetail/useEventDetail";
import type { EventItem } from "../eventsList/useEvents";

export default function BulkTicketDelivery() {
  const { eventId } = useParams({
    from: "/app-shell/events/$eventId/bulkTicketDelivery",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { sendViaEmail } = useAppInfo();

  const eventQuery = useQuery<EventItem>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });

  const participantsQuery = useQuery<ParticipantItem[]>({
    queryKey: ["participants", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/participants`),
    enabled: !!eventId,
  });

  const undeliveredReady = useMemo(
    () =>
      (participantsQuery.data ?? []).filter(
        (a) => !a.isTicketDelivered && a.isTicketReady && a.email,
      ),
    [participantsQuery.data],
  );

  const [previewIndex, setPreviewIndex] = useState(0);
  const [conflictDetail, setConflictDetail] = useState<string | null>(null);

  const clampedIndex = Math.min(
    previewIndex,
    Math.max(0, undeliveredReady.length - 1),
  );
  const currentParticipant = undeliveredReady[clampedIndex] ?? null;

  const previewQuery = useQuery({
    queryKey: ["emailPreview", eventId, currentParticipant?.id],
    queryFn: () =>
      api.getText(
        `/api/events/${eventId}/participants/${currentParticipant!.id}/email/preview`,
      ),
    enabled: !!currentParticipant,
  });

  const previewLoading = !!currentParticipant && previewQuery.isLoading;
  const displayHtml = previewQuery.data ?? null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const body = undeliveredReady.map((a) => a.id);
      const res = await api.post<{ detail?: unknown }>(
        `/api/events/${eventId}/emails`,
        body,
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      navigate({ to: "/events/$eventId", params: { eventId } });
    },
    onError: (err: ApiError) => {
      if (err.status === 409) {
        setConflictDetail(typeof err.detail === "string" ? err.detail : null);
      }
    },
  });

  const handlePrev = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const handleNext = () =>
    setPreviewIndex((i) => Math.min(undeliveredReady.length - 1, i + 1));

  const goBack = () =>
    navigate({ to: "/events/$eventId", params: { eventId } });

  if (eventQuery.isLoading || participantsQuery.isLoading) {
    return <LinearProgress />;
  }

  const event = eventQuery.data;

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)" }}>
      <Box sx={{ flex: 1, overflow: "auto", p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">{event?.name}</Typography>
          <Typography variant="h6">
            Bulk ticket delivery to undelivered guests
          </Typography>
          <Typography variant="body1">
            Confirm sending ticket email to the following guests
          </Typography>

          {undeliveredReady.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email address</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {undeliveredReady.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.title ? `${a.title} ` : ""}
                        {a.name}
                      </TableCell>
                      <TableCell>{a.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="textSecondary">
              No undelivered guests with ready tickets and email addresses.
            </Typography>
          )}

          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={undeliveredReady.length === 0}
            >
              Send to all
            </Button>
            <Button
              variant="outlined"
              onClick={goBack}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          bgcolor: "grey.100",
          p: 3,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            maxWidth: 700,
            width: "100%",
            mx: "auto",
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Paper elevation={2} sx={{ p: 2, flexShrink: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{ pb: 0.5, textAlign: "center" }}
            >
              <strong>Preview email</strong>
            </Typography>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "center" }}
              spacing={1}
            >
              <IconButton
                onClick={handlePrev}
                disabled={clampedIndex <= 0}
                size="small"
              >
                <NavigateBeforeIcon />
              </IconButton>
              <Typography
                variant="body1"
                sx={{ minWidth: 180, textAlign: "center" }}
              >
                {currentParticipant
                  ? `${currentParticipant.title ? `${currentParticipant.title} ` : ""}${currentParticipant.name}`
                  : "—"}
              </Typography>
              <IconButton
                onClick={handleNext}
                disabled={clampedIndex >= undeliveredReady.length - 1}
                size="small"
              >
                <NavigateNextIcon />
              </IconButton>
            </Stack>
          </Paper>

          <Paper
            elevation={2}
            sx={{
              overflow: "hidden",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {currentParticipant ? (
              <>
                <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
                  <Typography variant="body1">
                    <strong>From: </strong> {sendViaEmail}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
                  <Typography variant="body1">
                    <strong>To: </strong> {currentParticipant.email}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
                  <Typography variant="body1">
                    <strong>Subject:</strong> [Ticket] {event?.name}
                  </Typography>
                </Box>
                <Divider />
                <Box
                  sx={{ px: 2, py: 1, flex: 1, overflow: "auto", minHeight: 0 }}
                >
                  {previewLoading && (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", py: 4 }}
                    >
                      <CircularProgress size={32} />
                    </Box>
                  )}
                  {!previewLoading && displayHtml && (
                    <Box
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(displayHtml),
                      }}
                    />
                  )}
                  {!previewLoading && !displayHtml && (
                    <Typography color="textSecondary">
                      Failed to load preview.
                    </Typography>
                  )}
                </Box>
              </>
            ) : (
              <Box
                sx={{
                  p: 2,
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography color="textSecondary">
                  Select a participant to preview
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <ConflictDialog
        open={!!conflictDetail}
        title="Email sending in progress"
        detail={conflictDetail}
        onClose={() => setConflictDetail(null)}
      />
    </Box>
  );
}
