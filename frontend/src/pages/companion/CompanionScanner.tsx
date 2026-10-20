import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
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
import { useNavigate, useParams } from "@tanstack/react-router";
import { ApiError, useCompanionApi } from "@/api";
import CompanionAdminSessionAlert from "./CompanionAdminSessionAlert";
import useClearAdminSession from "./useClearAdminSession";
const CAMERA_KEY = "settings.webcamDeviceId";
const RESULT_MS = 2500;
const RESULT_ICON_SIZE = 96;
// Camera start errors arrive within this window; later errors are per-frame
// detection hiccups and should not swap the preview for an error message.
const CAMERA_START_MS = 4000;

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

export default function CompanionScanner() {
  const { eventId } = useParams({
    from: "/full-page/companion/events/$eventId/scanner" as unknown as any, // eslint-disable-line
  });
  const navigate = useNavigate();
  const api = useCompanionApi();
  const [display, setDisplay] = useState<Display | null>(null);
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
  const loadDisplay = useCallback(async () => {
    try {
      const d = await api.get<Display>(
        `/api/events/${eventId}/companion/display`,
      );
      setDisplay(d);
      setUnpaired(false);
      return true;
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        setUnpaired(true);
        return false;
      }
      return true;
    }
  }, [api, eventId]);

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
  }, [eventId, loadDisplay]);

  // A handheld shares the browser with the admin pages; leaving the admin
  // signed in would expose the admin section to whoever picks it up.
  const adminCleared = useClearAdminSession();

  useEffect(() => {
    mountedAt.current = Date.now();
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

  const showResult = (outcome: Exclude<ScanOutcome, null>) => {
    setResult(outcome);
    if (resultTimer.current !== null) window.clearTimeout(resultTimer.current);
    resultTimer.current = window.setTimeout(() => setResult(null), RESULT_MS);
  };

  const onScan = async (codes: unknown) => {
    if (busy || result || unpaired || display?.mode === "disabled") return;
    const text = Array.isArray(codes)
      ? String((codes[0] as { rawValue?: unknown } | undefined)?.rawValue ?? "")
      : String((codes as unknown) ?? "");
    if (!text) return;

    setBusy(true);
    try {
      const res = await api.post<{
        success: boolean;
        detail?: { title?: string | null; name?: string; reason?: string };
      }>(`/api/events/${eventId}/companion/scan`, { ticket: text });
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
        });
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        setUnpaired(true);
      } else {
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
      setBusy(false);
    }
  };

  if (unpaired) {
    return (
      <Box
        sx={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          p: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h5">This device is not paired.</Typography>
        <Typography color="text.secondary">
          The pairing token was rotated or the event was removed.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate({ to: "/companion" })}
        >
          Back to devices
        </Button>
      </Box>
    );
  }

  if (display?.mode === "disabled") {
    return (
      <Box
        sx={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 2,
          p: 4,
          bgcolor: "#000",
          color: "#fff",
        }}
      >
        <PhonelinkLockIcon sx={{ fontSize: 72 }} />
        <Typography variant="h6">QR scanner is disabled</Typography>
        <Typography variant="h4">{display.eventName}</Typography>
        <Typography variant="subtitle1">
          The scanner will activate once the host opens check-in.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#000",
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
        {cameraFailed ? (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 3,
              textAlign: "center",
            }}
          >
            <Typography color="error">
              Camera unavailable. Check camera settings on the devices page.
            </Typography>
          </Box>
        ) : (
          <QrScanner
            onScan={onScan}
            onError={() => {
              if (Date.now() - mountedAt.current < CAMERA_START_MS) {
                setCameraFailed(true);
              }
            }}
            paused={busy || !!result}
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
        )}
        {busy && !result && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              bgcolor: "background.paper",
            }}
          >
            <CircularProgress />
            <Typography variant="h6">Verifying...</Typography>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          width: "100%",
          px: 2,
          py: 1.5,
          bgcolor: "#111",
          color: "#fff",
        }}
      >
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
      </Box>

      {/* Result card: full-screen, non-transparent, same treatment as the
          kiosk so a scan result is unambiguous on a small handheld screen. */}
      <Dialog open={!!result} fullScreen>
        {result && (
          <Box
            onClick={() => setResult(null)}
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 3,
              p: 4,
            }}
          >
            {result.ok ? (
              <>
                <CheckCircleIcon
                  sx={{ fontSize: RESULT_ICON_SIZE, color: "success.main" }}
                />
                <Typography variant="h4">Checked in</Typography>
                <Typography variant="h6">
                  {result.title ? `${result.title} ` : ""}
                  {result.name}
                </Typography>
              </>
            ) : (
              <>
                <ErrorIcon
                  sx={{ fontSize: RESULT_ICON_SIZE, color: "error.main" }}
                />
                <Typography variant="h4">Not checked in</Typography>
                <Typography variant="h6">{result.reason}</Typography>
              </>
            )}
            <Typography variant="body1" color="textSecondary" sx={{ mt: 2 }}>
              Tap to dismiss
            </Typography>
          </Box>
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
    </Box>
  );
}
