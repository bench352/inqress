import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface Props {
  open: boolean;
  currentMode: string;
  pendingMode: string | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ModeDialog({
  open,
  pendingMode,
  loading,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Switch to{" "}
        {pendingMode &&
          pendingMode.charAt(0).toUpperCase() + pendingMode.slice(1)}{" "}
        mode?
      </DialogTitle>
      <DialogContent>
        {pendingMode === "test" && (
          <Typography variant="body1">
            Attendance is recorded for trying the flow out. Everything recorded
            in Test mode is removed when you leave Test mode.
          </Typography>
        )}
        {pendingMode === "disabled" && (
          <Typography variant="body1">
            Nobody can check in until you choose Test or Live again. Live
            attendance is kept.
          </Typography>
        )}
        {pendingMode === "live" && (
          <Typography variant="body1">
            Attendance will be recorded permanently, even if you disable the
            check-in later.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onConfirm} loading={loading}>
          Switch
        </Button>
      </DialogActions>
    </Dialog>
  );
}
