import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
} from "@mui/material";
import Editor from "@monaco-editor/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

export default function EmailTemplateDialog({ open, eventId, onClose }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const templateQuery = useQuery({
    queryKey: ["emailTemplate", eventId],
    queryFn: () =>
      api.get<{ text: string }>(`/api/events/${eventId}/emailTemplate`),
    enabled: open,
  });

  const [editedTemplate, setEditedTemplate] = useState<string | null>(null);

  const template = editedTemplate ?? templateQuery.data?.text ?? null;

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.put(`/api/events/${eventId}/emailTemplate`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? String(err.detail)
          : "Failed to save email template";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      key={`email-template-${open}`}
    >
      <DialogTitle>Edit Email Template</DialogTitle>
      <DialogContent sx={{ minHeight: 400 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Customize the HTML template below to personalize your ticket delivery
          email. Include these placeholders in the template, which will be
          automatically substituted by individual participant information when
          the email is sent.
        </Typography>
        <Box component="ul" sx={{ pl: 3, mt: 0, mb: 2 }}>
          {[
            { code: "{{ title }}", desc: "Title (e.g. Mr., Mrs., Dr.)" },
            { code: "{{ fullName }}", desc: "Full name of the participant" },
            { code: "{{ eventName }}", desc: "Name of the event" },
            {
              code: "{{ senderName }}",
              desc: 'Organization name, or "Event Organizer" if not set',
            },
            { code: "{{ ticketQR }}", desc: "Embedded QR code ticket image" },
          ].map(({ code, desc }) => (
            <Typography
              key={code}
              variant="body1"
              component="li"
              color="text.secondary"
            >
              <Box
                component="code"
                sx={{ fontFamily: "monospace", fontWeight: 600 }}
              >
                {code}
              </Box>
              {": "}
              {desc}
            </Typography>
          ))}
        </Box>
        {templateQuery.isLoading ? (
          <CircularProgress
            sx={{ display: "flex", justifyContent: "center", mt: 4 }}
          />
        ) : template !== null ? (
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Editor
              height="400px"
              defaultLanguage="html"
              value={template}
              onChange={(value) => setEditedTemplate(value ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 14 }}
            />
          </Paper>
        ) : (
          <Typography color="error">Failed to load template.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={() => saveMutation.mutate(template ?? "")}
          variant="contained"
          loading={saveMutation.isPending}
          disabled={template === null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
