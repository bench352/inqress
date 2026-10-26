import { type FormEvent, useState } from "react";
import { Alert, Box, Button, Stack, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { ApiError } from "@/api";
import AppDialog from "@/components/AppDialog";
import type { EventCreatePayload } from "../useEvents";

interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: EventCreatePayload) => Promise<void>;
  loading: boolean;
}

export default function AddEventDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: AddEventDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameError = submitted && !name.trim();
  const dateError = submitted && !date;

  const reset = () => {
    setSubmitted(false);
    setError(null);
    setName("");
    setDescription("");
    setDate(dayjs());
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !date) return;
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        date: date.format("YYYY-MM-DD"),
      });
      reset();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? String(err.detail)
          : "Could not create the event. Try again.",
      );
    }
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="New event"
      actions={
        <>
          <Button type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="add-event-form" loading={loading}>
            Create event
          </Button>
        </>
      }
    >
      <Box
        component="form"
        id="add-event-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={nameError}
            helperText={nameError ? "Enter a name for the event." : undefined}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          <DatePicker
            label="Date"
            value={date}
            onChange={setDate}
            format="YYYY-MM-DD"
            slotProps={{
              textField: {
                required: true,
                error: dateError,
                helperText: dateError ? "Pick a date." : undefined,
              },
            }}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </Box>
    </AppDialog>
  );
}
