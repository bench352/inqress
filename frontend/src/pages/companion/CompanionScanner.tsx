import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { Scanner as QrScanner } from "@yudiel/react-qr-scanner";
import PhonelinkLockIcon from "@mui/icons-material/PhonelinkLock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SensorsOutlinedIcon from "@mui/icons-material/SensorsOutlined";
import SensorsOffOutlinedIcon from "@mui/icons-material/SensorsOffOutlined";
import ErrorIcon from "@mui/icons-material/Error";
import { useParams } from "@tanstack/react-router";
import { ApiError, useCompanionApi } from "@/api";
import { useBootHold } from "@/components/bootHold";
import scannedBeep from "@/assets/soundEffects/scanned_beep.aac";
import lowBatterySound from "@/assets/soundEffects/low_battery_alert.aac";
import { playSound, useSounds } from "./sounds";
import CompanionAdminSessionAlert from "./CompanionAdminSessionAlert";
import useClearAdminSession from "./useClearAdminSession";
import BatteryIndicator from "./BatteryIndicator";
import useBattery, { type BatteryState } from "./useBattery";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

const CAMERA_KEY = "settings.webcamDeviceId";
const RESULT_MS = 6000;
const RESULT_ICON_SIZE = 60;
// A tracker drops the library's idle rate to 33ms. Stay at the idle pace so a
// result dialog does not keep the decoder hot.
const SCAN_INTERVAL_MS = 500;
// Camera start errors arrive within this window; later errors are per-frame
// detection hiccups and should not swap the preview for an error message.
const CAMERA_START_MS = 4000;
// A ticket seen again within this window is the same hold, not a new scan.
// Long enough to survive a dropped detection frame, short enough to retry.
const SEEN_WINDOW_MS = 3000;
// A failed display read on first load would otherwise leave the scanner waiting
// until a reload.
const DISPLAY_RETRY_MS = 5000;
const SCANNER_SOUNDS = [scannedBeep, lowBatterySound];

function rawValues(codes: unknown): string[] {
  if (!Array.isArray(codes)) {
    const value = String(codes ?? "");
    return value ? [value] : [];
  }
  return codes
    .map((code) =>
      String((code as { rawValue?: unknown } | undefined)?.rawValue ?? ""),
    )
    .filter(Boolean);
}

interface Display {
  eventName: string;
  kioskMessage: string;
  mode: string;
}

type ConnectionStatus = "connecting" | "connected" | "lost";

type ScanOutcome = {
  ok: boolean;
  title?: string | null;
  name?: string;
  reason?: string;
} | null;

// Shared bottom bar, so a closed scanner keeps the event name and the status
// mark instead of swapping to a full-screen layout without them.
function ScannerFooter({
  display,
  status,
  battery,
  warn,
  busy = false,
}: {
  display: Display | null;
  status: ConnectionStatus;
  battery: BatteryState | null;
  warn: boolean;
  busy?: boolean;
}) {
  return (
    <Box sx={{ width: "100%", px: 2, py: 1.5, bgcolor: "#111", color: "#fff" }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Typography variant="body1" noWrap sx={{ minWidth: 0 }}>
            {display?.eventName ?? ""}
          </Typography>
          {display?.mode === "test" && (
            <Chip label="TEST" size="small" color="warning" />
          )}
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexShrink: 0 }}
        >
          {busy && (
            <CircularProgress
              size={18}
              color="inherit"
              aria-label="Verifying ticket"
            />
          )}
          <BatteryIndicator battery={battery} warn={warn} size="small" />
          {status === "connected" ? (
            <SensorsOutlinedIcon
              fontSize="small"
              sx={{ color: "#fff", flexShrink: 0 }}
            />
          ) : (
            <SensorsOffOutlinedIcon
              fontSize="small"
              color="error"
              sx={{ flexShrink: 0 }}
            />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

export default function CompanionScanner() {
  const { eventId } = useParams({ strict: false }) as { eventId: string };
  const api = useCompanionApi();
  const [display, setDisplay] = useState<Display | null>(null);
  const [displayLoaded, setDisplayLoaded] = useState(false);
  const [unpaired, setUnpaired] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [result, setResult] = useState<ScanOutcome>(null);
  const [busy, setBusy] = useState(false);
  const [cameraDeviceId] = useState(
    () => localStorage.getItem(CAMERA_KEY) || "",
  );
  const esRef = useRef<EventSource | null>(null);
  const resultTimer = useRef<number | null>(null);
  const mountedAt = useRef(0);
  const seenTicket = useRef<string | null>(null);
  const seenAt = useRef(0);
  const acceptLock = useRef(false);
  const resultRef = useRef<ScanOutcome>(null);
  const cameraOnRef = useRef(false);
  const dismissResult = useCallback(() => {
    resultRef.current = null;
    setResult(null);
    if (resultTimer.current !== null) {
      window.clearTimeout(resultTimer.current);
      resultTimer.current = null;
    }
  }, []);

  // Called where the camera pauses, so a result cannot outlive its check-in.
  const pauseScanner = useCallback(() => {
    // Closes the window where a scan already in flight could still show a
    // result after the mode left live/test.
    cameraOnRef.current = false;
    dismissResult();
    setCameraFailed(false);
    seenTicket.current = null;
  }, [dismissResult]);

  const loadDisplay = useCallback(async () => {
    try {
      const d = await api.get<Display>(
        `/api/events/${eventId}/companion/display`,
      );
      setDisplay(d);
      setUnpaired(false);
      if (d.mode === "disabled") pauseScanner();
      return true;
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
        setUnpaired(true);
        pauseScanner();
        return false;
      }
      return true;
    } finally {
      setDisplayLoaded(true);
    }
  }, [api, eventId, pauseScanner]);

  const connect = useCallback(() => {
    esRef.current?.close();
    const url = `${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/events/${eventId}/companion/streams?mode=scanner`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => setStatus("connected");
    es.onerror = () => {
      setStatus("lost");
      void loadDisplay().then((paired) => {
        if (!paired) es.close();
      });
    };
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (
          parsed.eventType === "CHANGE_MODE" &&
          typeof parsed.data?.value === "string"
        ) {
          setDisplay((d) => (d ? { ...d, mode: parsed.data.value } : d));
          if (parsed.data.value !== "test" && parsed.data.value !== "live") {
            pauseScanner();
          }
        }
        if (parsed.eventType === "CONTROL") {
          if (parsed.data?.command === "CLOSE") {
            window.location.assign("/companion");
          }
          if (parsed.data?.command === "REFRESH") {
            window.location.reload();
          }
        }
      } catch {
        // ignore malformed events
      }
    };
  }, [eventId, loadDisplay, pauseScanner]);

  // A handheld shares the browser with the admin pages; leaving the admin
  // signed in would expose the admin section to whoever picks it up.
  const adminCleared = useClearAdminSession();

  const battery = useBattery();
  const soundsReady = useSounds(SCANNER_SOUNDS);
  useBootHold(
    !unpaired && !(display !== null && soundsReady),
    "Getting scanner ready...",
  );

  useEffect(() => {
    (async () => {
      await loadDisplay();
    })();
    connect();
    return () => {
      esRef.current?.close();
      if (resultTimer.current !== null)
        window.clearTimeout(resultTimer.current);
    };
  }, [loadDisplay, connect]);

  // The scanner stays mounted for the whole visit. Pausing it is the only stop
  // that is queued behind a camera start already in flight; unmounting is not.
  const cameraOn =
    !unpaired &&
    display !== null &&
    (display.mode === "test" || display.mode === "live");

  useEffect(() => {
    cameraOnRef.current = cameraOn;
    if (cameraOn) {
      // The error window starts when the lens starts, not when the page does.
      mountedAt.current = Date.now();
    }
  }, [cameraOn]);

  useEffect(() => {
    if (!displayLoaded || display || unpaired) return;
    const id = window.setInterval(() => void loadDisplay(), DISPLAY_RETRY_MS);
    return () => window.clearInterval(id);
  }, [displayLoaded, display, unpaired, loadDisplay]);

  const showResult = (outcome: Exclude<ScanOutcome, null>) => {
    resultRef.current = outcome;
    setResult(outcome);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(dismissResult, RESULT_MS);
  };

  const onScan = async (codes: unknown) => {
    const text = rawValues(codes)[0];
    if (!text) return;
    // Refresh even while a result dialog is up, so a held ticket stays held.
    if (
      text === seenTicket.current &&
      Date.now() - seenAt.current < SEEN_WINDOW_MS
    ) {
      seenAt.current = Date.now();
      return;
    }
    if (acceptLock.current || resultRef.current || !cameraOnRef.current) {
      return;
    }

    acceptLock.current = true;
    seenTicket.current = text;
    seenAt.current = Date.now();
    setBusy(true);
    // Beep as soon as the ticket is accepted, not when the result arrives.
    playSound(scannedBeep);
    try {
      const res = await api.post<{
        success: boolean;
        detail?: { title?: string | null; name?: string; reason?: string };
      }>(`/api/events/${eventId}/companion/scan`, { ticket: text });
      // Check-in may have closed while the scan was in flight.
      if (!cameraOnRef.current) return;
      if (res.success) {
        showResult({
          ok: true,
          title: res.detail?.title ?? null,
          name: res.detail?.name ?? "",
        });
      } else {
        showResult({
          ok: false,
          reason: res.detail?.reason ?? "Check-in failed",
          title: res.detail?.title ?? null,
          name: res.detail?.name,
        });
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        setUnpaired(true);
        pauseScanner();
      } else if (cameraOnRef.current) {
        const detail =
          e && typeof e === "object" && "detail" in e
            ? (e as { detail: unknown }).detail
            : null;
        showResult({
          ok: false,
          reason: typeof detail === "string" ? detail : "Check-in failed",
        });
      }
    } finally {
      acceptLock.current = false;
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#000",
        color: "#fff",
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <QrScanner
          paused={!cameraOn}
          onScan={onScan}
          onError={() => {
            if (cameraOn && Date.now() - mountedAt.current < CAMERA_START_MS) {
              setCameraFailed(true);
            }
          }}
          allowMultiple
          scanDelay={SCAN_INTERVAL_MS}
          retryDelay={SCAN_INTERVAL_MS}
          sound={false}
          tracker={(codes) => {
            const ticket = seenTicket.current;
            if (ticket && codes.some((code) => code.rawValue === ticket)) {
              seenAt.current = Date.now();
            }
          }}
          constraints={
            cameraDeviceId
              ? {
                  deviceId: { exact: cameraDeviceId },
                  width: { ideal: 1080 },
                  height: { ideal: 1920 },
                }
              : {
                  facingMode: "environment",
                  width: { ideal: 1080 },
                  height: { ideal: 1920 },
                }
          }
          components={{
            finder: false,
            torch: false,
            onOff: false,
            zoom: false,
          }}
          styles={{
            container: { width: "100%", height: "100%", aspectRatio: "auto" },
            video: { width: "100%", height: "100%", objectFit: "cover" },
          }}
        />

        {!display ? (
          !unpaired && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress color="inherit" />
            </Box>
          )
        ) : display.mode === "disabled" ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 2,
              p: 4,
              bgcolor: "#000",
            }}
          >
            <PhonelinkLockIcon sx={{ fontSize: 72 }} />
            <Typography variant="h6">QR scanner is disabled</Typography>
            <Typography variant="h4">{display.eventName}</Typography>
            <Typography variant="subtitle1">
              The scanner will activate once the host opens check-in.
            </Typography>
          </Box>
        ) : cameraFailed ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 3,
              textAlign: "center",
              bgcolor: "#000",
            }}
          >
            <Typography color="warning">
              Camera unavailable. Check camera settings on the devices page.
            </Typography>
          </Box>
        ) : null}
      </Box>

      <ScannerFooter
        display={display}
        status={status}
        battery={battery}
        warn={!result}
        busy={busy && cameraOn && !result}
      />

      <Dialog
        open={!!result}
        onClose={dismissResult}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { onClick: dismissResult } }}
      >
        {result && (
          <>
            <DialogContent>
              <Stack
                spacing={2}
                sx={{ alignItems: "center", textAlign: "center" }}
              >
                {result.ok ? (
                  <CheckCircleIcon
                    color="success"
                    sx={{ fontSize: RESULT_ICON_SIZE }}
                  />
                ) : (
                  <ErrorIcon
                    color="error"
                    sx={{ fontSize: RESULT_ICON_SIZE }}
                  />
                )}
                <Typography variant="h5" sx={{ fontWeight: 500 }} noWrap>
                  {result.ok
                    ? "Check-in successful"
                    : (result.reason ?? "Unknown error")}
                </Typography>
                {result.name && (
                  <Typography variant="h4" sx={{ fontWeight: 900 }} noWrap>
                    {result.title ? `${result.title} ` : ""}
                    {result.name}
                  </Typography>
                )}
                <Typography variant="body1" color="textSecondary">
                  Tap to dismiss
                </Typography>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>

      <Snackbar
        open={status === "lost" && !unpaired}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message="Connection to the server was lost"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        }
      />

      <CompanionAdminSessionAlert show={adminCleared} />

      {unpaired && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            p: 3,
            textAlign: "center",
            bgcolor: "#FFFFFF",
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 100, color: "error.main" }} />
          <Typography variant="h6" color="error">
            This scanner cannot be used
          </Typography>
          <Typography color="textSecondary" variant="body1">
            The pairing token was rotated or the event was removed.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
