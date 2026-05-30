import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

interface Props {
  open: boolean;
  currentDate: string;
  loading: boolean;
  onClose: () => void;
  onSave: (date: string) => void;
}

export default function DateDialog({
  open,
  currentDate,
  loading,
  onClose,
  onSave,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() => dayjs(currentDate));

  const handleSave = () => {
    if (selectedDate) {
      onSave(selectedDate.format("YYYY-MM-DD"));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      key={String(open)}
    >
      <DialogTitle>Change Event Date</DialogTitle>
      <DialogContent>
        <DatePicker
          label="Date"
          value={selectedDate}
          onChange={setSelectedDate}
          format="YYYY-MM-DD"
          sx={{ mt: 1, width: "100%" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
