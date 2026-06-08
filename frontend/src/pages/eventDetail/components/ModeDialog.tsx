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
        Confirm changing to "
        {pendingMode &&
          pendingMode.charAt(0).toUpperCase() + pendingMode.slice(1)}
        " mode
      </DialogTitle>
      <DialogContent>
        {pendingMode === "test" && (
          <Typography variant="body1">
            Feel free to test the check-in flow as attendance records are
            temporarily recorded. Once you switch back to Disabled mode, all
            records created during Test mode will be rolled back.
          </Typography>
        )}
        {pendingMode === "disabled" && (
          <Typography variant="body1">
            Attendance will no longer be accepted. All attendance recorded
            during Live mode will be kept, while those created during Test mode
            will be rolled back.
          </Typography>
        )}
        {pendingMode === "live" && (
          <Typography variant="body1">
            Attendance will be recorded permanently. It will be kept even if you
            switch to Disabled mode later.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" loading={loading}>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
