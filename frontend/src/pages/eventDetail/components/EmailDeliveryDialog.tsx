import { type FormEvent } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import { useAppInfo } from "@/providers/useAppInfo";

interface EmailSettings {
  subject: string | null;
  senderName: string | null;
}

interface Props {
  open: boolean;
  eventId: string;
  eventName: string;
  onClose: () => void;
}

export default function EmailDeliveryDialog({
  open,
  eventId,
  eventName,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { orgName } = useAppInfo();

  const settingsQuery = useQuery({
    queryKey: ["emailSettings", eventId],
    queryFn: () =>
      api.get<EmailSettings>(`/api/events/${eventId}/emailSettings`),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: EmailSettings) =>
      api.put(`/api/events/${eventId}/emailSettings`, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailSettings", eventId] });
      onClose();
    },
    onError: () => {
      enqueueSnackbar("Failed to save email delivery settings", {
        variant: "error",
      });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const clean = (name: string) => String(data.get(name) ?? "").trim() || null;
    saveMutation.mutate({
      subject: clean("subject"),
      senderName: clean("senderName"),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Email Delivery</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Leave a field blank to use the default shown.
        </DialogContentText>
        {settingsQuery.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!settingsQuery.isLoading && !settingsQuery.data && (
          <Typography color="error">Failed to load email settings.</Typography>
        )}
        {settingsQuery.data && (
          <Box
            component="form"
            id="email-delivery-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                name="subject"
                label="Subject"
                defaultValue={settingsQuery.data.subject ?? ""}
                placeholder={`[Ticket] ${eventName}`}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                name="senderName"
                label="Sender name"
                defaultValue={settingsQuery.data.senderName ?? ""}
                placeholder={orgName || "Event Organizer"}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="email-delivery-form"
          variant="contained"
          loading={saveMutation.isPending}
          disabled={!settingsQuery.data}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
