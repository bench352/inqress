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
import useSound from "use-sound";
import lowBatterySound from "@/assets/soundEffects/low_battery_alert.aac";
import { type BatteryState, LOW_PERCENT } from "./useBattery";

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
  const dialogOpen =
    battery != null &&
    warn &&
    !battery.charging &&
    battery.percent < LOW_PERCENT &&
    !battery.dismissed;

  const [playLowBattery] = useSound(lowBatterySound);
  useEffect(() => {
    if (dialogOpen) playLowBattery();
  }, [dialogOpen, playLowBattery]);

  // Unsupported browsers get no mark at all, rather than an empty gap.
  if (!battery) return null;

  const { percent, charging, dismiss } = battery;
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
      <Dialog open={dialogOpen} onClose={dismiss} maxWidth="xs" fullWidth>
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
          <Button onClick={dismiss}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
