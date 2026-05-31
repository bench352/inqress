import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  detail: string | null;
  onClose: () => void;
}

export default function ConflictDialog({
  open,
  title,
  detail,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{detail ?? "Conflict detected"}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
}
