import { useEffect, useState } from "react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  attendeeId: string;
  attendeeEmail: string;
  eventName: string;
  onClose: () => void;
}

export default function EmailTicketDialog({
  open,
  eventId,
  attendeeId,
  attendeeEmail,
  eventName,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getText(`/api/events/${eventId}/attendees/${attendeeId}/email/preview`)
      .then((html) => {
        if (!cancelled) {
          setPreviewHtml(html);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, attendeeId, api]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/events/${eventId}/attendees/${attendeeId}/email`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
      onClose();
    },
  });

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
          <Typography variant="body2">
            This email will be sent to{" "}
            <Box component="strong">{attendeeEmail}</Box>.
          </Typography>
        </Stack>
        <Box sx={{ mt: 2 }}>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {!loading && !previewHtml && (
            <Typography color="error">Failed to load email preview.</Typography>
          )}
          {previewHtml && (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
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
                dangerouslySetInnerHTML={{ __html: previewHtml }}
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
