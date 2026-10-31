import { useEffect } from "react";
import { Dialog, DialogContent, Stack, Typography } from "@mui/material";
import PowerOutlinedIcon from "@mui/icons-material/PowerOutlined";
import Battery0BarOutlinedIcon from "@mui/icons-material/Battery0BarOutlined";
import BatteryAlertIcon from "@mui/icons-material/BatteryAlert";
import { type BatteryState, LOW_PERCENT } from "./useBattery";
import lowBatterySound from "@/assets/soundEffects/companion_battery_low.aac";
import { playSound, stopSound } from "./sounds";

interface Props {
  battery: BatteryState | null;
  /** False while a full-screen dialog or result would be covered. */
  warn?: boolean;
  size?: "small" | "medium";
}

// Matches the scanner result card on both devices.
const ALERT_ICON_SIZE = 60;
// 500ms on, 500ms off, four times: the length of the alert sound.
const ALERT_VIBRATION = [500, 500, 500, 500, 500, 500, 500, 500];

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
    if (!open) return;
    playSound(lowBatterySound);
    // Silent where there is no vibrator, no API, or no prior tap.
    navigator.vibrate?.(ALERT_VIBRATION);
    // Closing the card cuts both; neither runs on under what replaced it.
    return () => {
      stopSound(lowBatterySound);
      navigator.vibrate?.(0);
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { onClick: onClose } }}
    >
      <DialogContent>
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
          <BatteryAlertIcon color="error" sx={{ fontSize: ALERT_ICON_SIZE }} />
          <Typography variant="h5" color="error" sx={{ fontWeight: 500 }}>
            Battery is low
          </Typography>
          <Typography variant="body1">
            Please plug in this device before it runs out of charge.
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Tap to dismiss
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
