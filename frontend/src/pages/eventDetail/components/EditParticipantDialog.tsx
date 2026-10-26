import { type FormEvent, useState } from "react";
import { Box, Button, Stack, TextField } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "../../../api";
import AppDialog from "@/components/AppDialog";
import type { ParticipantItem } from "../useEventDetail";

interface Props {
  open: boolean;
  participant: ParticipantItem;
  eventId: string;
  onClose: () => void;
}

export default function EditParticipantDialog({
  open,
  participant,
  eventId,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [title, setTitle] = useState(participant.title ?? "");
  const [name, setName] = useState(participant.name);
  const [email, setEmail] = useState(participant.email ?? "");
  const [rawPhone, setRawPhone] = useState(participant.rawPhone ?? "");
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && !name.trim();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put(`/api/events/${eventId}/participants/${participant.id}`, {
        title: title || null,
        name,
        email: email || null,
        rawPhone: rawPhone || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      onClose();
    },
    onError: () => {
      enqueueSnackbar("Could not save this participant. Try again.", {
        variant: "error",
      });
    },
  });

  const handleSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim()) return;
    mutation.mutate();
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Edit details"
      actions={
        <>
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-participant-form"
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <Box
        component="form"
        id="edit-participant-form"
        onSubmit={handleSave}
        noValidate
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            placeholder="e.g. Mr., Mrs., Dr."
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={nameError}
            helperText={nameError ? "Enter the participant's name." : undefined}
          />
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            type="email"
            placeholder="Optional"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Phone"
            value={rawPhone}
            onChange={(e) => setRawPhone(e.target.value)}
            fullWidth
            placeholder="Optional"
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </Box>
    </AppDialog>
  );
}
