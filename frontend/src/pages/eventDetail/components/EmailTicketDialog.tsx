import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  participantId: string;
  participantEmail: string;
  eventName: string;
  onClose: () => void;
}

export default function EmailTicketDialog({
  open,
  eventId,
  participantId,
  participantEmail,
  eventName,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  const previewQuery = useQuery({
    queryKey: ["emailPreview", eventId, participantId],
    queryFn: () =>
      api.getText(
        `/api/events/${eventId}/participants/${participantId}/email/preview`,
      ),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/events/${eventId}/participants/${participantId}/email`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      onClose();
    },
  });

  const previewHtml = previewQuery.data ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      key={`email-ticket-${open}`}
    >
      <DialogTitle>Email Ticket</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body1">
            This email will be sent to{" "}
            <Box component="strong">{participantEmail}</Box>.
          </Typography>
        </Stack>
        <Box sx={{ mt: 2 }}>
          {previewQuery.isLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!previewQuery.isLoading && !previewHtml && (
            <Typography color="error">Failed to load email preview.</Typography>
          )}
          {previewHtml && (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="body1" color="textSecondary">
                  Subject: [Ticket] {eventName}
                </Typography>
              </Box>
              <Divider />
              <Box
                sx={{
                  p: 2,
                  maxHeight: 400,
                  overflow: "auto",
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(previewHtml),
                }}
              />
            </Paper>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sendMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => sendMutation.mutate()}
          variant="contained"
          loading={sendMutation.isPending}
          disabled={!previewHtml}
        >
          Send Email
        </Button>
      </DialogActions>
    </Dialog>
  );
}
