import { useEffect } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import PowerOutlinedIcon from "@mui/icons-material/PowerOutlined";
import Battery0BarOutlinedIcon from "@mui/icons-material/Battery0BarOutlined";
import BatteryAlertOutlinedIcon from "@mui/icons-material/BatteryAlertOutlined";
import { type BatteryState, LOW_PERCENT } from "./useBattery";
import lowBatterySound from "@/assets/soundEffects/low_battery_alert.aac";
import { playSound } from "./sounds";

interface Props {
  battery: BatteryState | null;
  /** False while a full-screen dialog or result would be covered. */
  warn?: boolean;
  size?: "small" | "medium";
}

export default function BatteryIndicator({
  battery,
  warn = true,
  size = "medium",
}: Props) {
  // Unsupported browsers get no mark at all, rather than an empty gap.
  if (!battery) return null;

  const { percent, charging, dismiss, dismissed } = battery;
  const low = !charging && percent < LOW_PERCENT;

  return (
    <>
      <Stack
        direction="row"
        spacing={0}
        role="img"
        aria-label={`Battery ${percent}%, ${charging ? "charging" : "not charging"}`}
        sx={{
          alignItems: "center",
          flexShrink: 0,
          lineHeight: 1,
          color: low ? "error.main" : "inherit",
        }}
      >
        <Typography
          component="span"
          variant={size === "small" ? "body2" : "body1"}
          sx={{ fontWeight: 500 }}
        >
          {percent}%
        </Typography>
        {charging ? (
          <PowerOutlinedIcon fontSize={size} aria-hidden />
        ) : (
          <Battery0BarOutlinedIcon fontSize={size} aria-hidden />
        )}
      </Stack>
      <LowBatteryAlert open={warn && low && !dismissed} onClose={dismiss} />
    </>
  );
}

// Mounted only once battery info exists, so unsupported browsers never load
// the warning sound.
function LowBatteryAlert({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (open) playSound(lowBatterySound);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <BatteryAlertOutlinedIcon />
          <Typography variant="inherit" component="span">
            Battery is low
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Please plug in this device before it runs out of charge.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
