import { useState } from "react";
import {
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

  const handleSubmit = () => {
    if (!name.trim() || !date) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      date: date.format("YYYY-MM-DD"),
    });
    setName("");
    setDescription("");
    setDate(dayjs());
    onClose();
  };

  const handleClose = () => {
    if (!loading) {
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
        <TextField
          autoFocus
          margin="dense"
          label="Event Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
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
          sx={{ mt: 1, width: "100%" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name.trim()}
        >
          Create Event
        </Button>
      </DialogActions>
    </Dialog>
  );
}
