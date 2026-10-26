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
            Attendance is recorded for trying the flow out. When you switch to
            Disabled, everything recorded in Test mode is removed.
          </Typography>
        )}
        {pendingMode === "disabled" && (
          <Typography variant="body1">
            Nobody can check in until you choose Test or Live again. Real
            attendance stays; anything from Test mode is removed.
          </Typography>
        )}
        {pendingMode === "live" && (
          <Typography variant="body1">
            Attendance is kept for good, even if you switch to Disabled later.
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
