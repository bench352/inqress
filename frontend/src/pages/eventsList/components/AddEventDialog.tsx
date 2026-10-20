import { type FormEvent, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import type { EventCreatePayload } from "../useEvents";

interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: EventCreatePayload) => void;
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
  const nameError = submitted && !name.trim();
  const dateError = submitted && !date;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !date) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      date: date.format("YYYY-MM-DD"),
    });
    setSubmitted(false);
    setName("");
    setDescription("");
    setDate(dayjs());
    onClose();
  };

  const handleClose = () => {
    if (!loading) {
      setSubmitted(false);
      setName("");
      setDescription("");
      setDate(dayjs());
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Event</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="add-event-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <TextField
            autoFocus
            margin="dense"
            label="Event Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={nameError}
            helperText={nameError ? "Event name is required" : " "}
          />
          <TextField
            margin="dense"
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
                helperText: dateError ? "Date is required" : " ",
              },
            }}
            sx={{ mt: 1, width: "100%" }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="add-event-form"
          variant="contained"
          disabled={loading}
        >
          Create Event
        </Button>
      </DialogActions>
    </Dialog>
  );
}
