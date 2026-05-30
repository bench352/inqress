import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import type { AttendanceDialogEntry } from "../../../hooks/useEventStream";

interface Props {
  dialog: AttendanceDialogEntry;
  onDismiss: () => void;
}

const TOTAL_SECONDS = 30;
const PROGRESS_INTERVAL_MS = 100;

function formatMethod(method: string): string {
  switch (method) {
    case "scan":
      return "QR scan";
    case "phone":
      return "Phone number";
    case "manual":
      return "Manual entry";
    default:
      return method;
  }
}

export default function CheckinNotificationDialog({
  dialog,
  onDismiss,
}: Props) {
  const [countdown, setCountdown] = useState(TOTAL_SECONDS);
  const [progress, setProgress] = useState(100);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDismiss = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next =
          prev - 100 / ((TOTAL_SECONDS * 1000) / PROGRESS_INTERVAL_MS);
        return next <= 0 ? 0 : next;
      });
    }, PROGRESS_INTERVAL_MS);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [handleDismiss]);

  const formattedTime = dayjs(dialog.checkInAt).format("MMM D, YYYY h:mm A");

  return (
    <Dialog open onClose={handleDismiss} maxWidth="xs" fullWidth>
      <LinearProgress variant="determinate" value={progress} />
      <DialogTitle sx={{ textAlign: "center", pb: 0 }}>Checked In</DialogTitle>
      <DialogContent sx={{ textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 1 }}>
          {dialog.title} {dialog.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Checked in at {formattedTime}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          By {formatMethod(dialog.checkInMethod)}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button variant="outlined" onClick={handleDismiss}>
          Dismiss ({countdown}s)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
