import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import NoMeetingRoomIcon from "@mui/icons-material/NoMeetingRoom";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ApiError, useCompanionApi } from "@/api";
import { useBootHold } from "@/components/bootHold";
import { useSystemClock } from "@/providers/useSystemClock";
import successSound from "@/assets/soundEffects/checkin_success.aac";
import failSound from "@/assets/soundEffects/checkin_fail.aac";
import confirmSound from "@/assets/soundEffects/checkin_need_confirmation.aac";
import lowBatterySound from "@/assets/soundEffects/low_battery_alert.aac";
import { useSounds } from "./sounds";
import KioskPhoneDialog from "./kiosk/KioskPhoneDialog";
import KioskEmailDialog from "./kiosk/KioskEmailDialog";
import AssistedConfirmationDialog from "./kiosk/AssistedConfirmationDialog";
import CheckinResultDisplay from "./kiosk/CheckinResultDisplay";
import type { CheckinResponse } from "./kiosk/types";
import CompanionAdminSessionAlert from "./CompanionAdminSessionAlert";
import useClearAdminSession from "./useClearAdminSession";
import BatteryIndicator from "./BatteryIndicator";
import useBattery, { type BatteryState } from "./useBattery";

interface Display {
  eventName: string;
  kioskMessage: string;
  mode: string;
}

type DialogKind = "phone" | "email" | null;

type ResultPhase = "loading" | "success" | "error";
type StreamStatus = "connecting" | "connected" | "lost";

const KIOSK_SOUNDS = [successSound, failSound, confirmSound, lowBatterySound];
const RETRY_MS = 5000;

const KIOSK_DISABLED_SX = {
  height: "100dvh",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 3,
  p: 4,
} as const;

function KioskDisabledScreen({
  eventName,
  status,
  battery,
}: {
  eventName?: string;
  status: StreamStatus;
  battery: BatteryState | null;
}) {
  return (
    <Box sx={KIOSK_DISABLED_SX}>
      <NoMeetingRoomIcon sx={{ fontSize: 200 }} />
      <Typography variant="h3" sx={{ fontWeight: 900 }}>
        Check-in will open shortly
      </Typography>
      <Typography
        variant="h5"
        sx={{ fontWeight: 500, opacity: 0.75, maxWidth: 900 }}
      >
        Please wait until the host opens check-in{" "}
        {eventName ? `for ${eventName}` : ""}.
      </Typography>
      <KioskStatusLine status={status} battery={battery} />
    </Box>
  );
}

// Bottom-right stream status: battery, test-mode indicator, live indicator,
// then the wall clock.
function KioskStatusLine({
  status,
  mode,
  battery,
  warn = true,
}: {
  status: StreamStatus;
  mode?: string;
  battery: BatteryState | null;
  warn?: boolean;
}) {
  const { time } = useSystemClock();
  const connected = status === "connected";
  return (
    <Stack
      direction="row"
      spacing={1.5}
      data-testid="kiosk-status-line"
      sx={{
        position: "absolute",
        right: 32,
        bottom: 32,
        alignItems: "center",
        lineHeight: 1,
        color: "textPrimary",
      }}
    >
      <BatteryIndicator battery={battery} warn={warn} />
      {mode === "test" && (
        <ScienceOutlinedIcon fontSize="medium" color="warning" />
      )}
      {connected ? (
        <CloudDoneOutlinedIcon fontSize="medium" sx={{ color: "#000" }} />
      ) : (
        <CloudOffOutlinedIcon fontSize="medium" color="error" />
      )}
      <Typography
        variant="body1"
        component="span"
        sx={{ fontSize: "35px", fontWeight: 500 }}
      >
        {time}
      </Typography>
    </Stack>
  );
}

export default function CompanionKiosk() {
  const { eventId } = useParams({ strict: false }) as { eventId: string };
  const api = useCompanionApi();
  const navigate = useNavigate();
  const [display, setDisplay] = useState<Display | null>(null);
  const [unpaired, setUnpaired] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [scanResult, setScanResult] = useState<{
    key: number;
    phase: ResultPhase;
    result: CheckinResponse;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverReady, setCoverReady] = useState(false);
  const [accentReady, setAccentReady] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [pendingConfirm, setPendingConfirm] = useState<{
    participantId: string;
    title: string | null;
    name: string;
    countryCode: string | null;
    phone: string | null;
    email: string | null;
  } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const dialogRef = useRef<DialogKind>(null);
  const displayRef = useRef<Display | null>(null);
  const pendingConfirmRef = useRef<typeof pendingConfirm>(null);
  const ownCheckinRef = useRef<{ name: string; ts: number } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const scanSeqRef = useRef(0);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setBanner(null);
  }, []);
  const closeConfirm = useCallback(() => {
    setPendingConfirm(null);
    setBanner(null);
  }, []);
  const markOwnCheckin = useCallback((name: string) => {
    ownCheckinRef.current = { name, ts: Date.now() };
  }, []);

  useEffect(() => {
    dialogRef.current = dialog;
    displayRef.current = display;
    pendingConfirmRef.current = pendingConfirm;
  }, [dialog, display, pendingConfirm]);

  // A kiosk shares the browser with the admin pages; leaving the admin signed
  // in would expose the admin section to whoever walks up to the device.
  const adminCleared = useClearAdminSession();

  const battery = useBattery();
  const soundsReady = useSounds(KIOSK_SOUNDS);
  const boothReady = displayReady && accentReady && coverReady && soundsReady;
  useBootHold(!unpaired && !boothReady, "Getting kiosk ready...");

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        const d = await api.get<Display>(
          `/api/events/${eventId}/companion/display`,
        );
        if (cancelled) return;
        setDisplay(d);
        setDisplayReady(true);
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          setUnpaired(true);
          return;
        }
        timer = window.setTimeout(() => void load(), RETRY_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [eventId, api]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        const c = await api.get<{ colorCode: string }>(
          `/api/events/${eventId}/companion/accentColor`,
        );
        if (cancelled) return;
        setAccentColor(c.colorCode);
        setAccentReady(true);
      } catch (e: unknown) {
        if (cancelled) return;
        // A themed default is fine; only a network failure is worth retrying.
        if (e instanceof ApiError) {
          setAccentReady(true);
          return;
        }
        timer = window.setTimeout(() => void load(), RETRY_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [eventId, api]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let objectUrl: string | null = null;

    const load = async () => {
      let blob: Blob;
      try {
        blob = await api.getBlob(`/api/events/${eventId}/companion/boothImage`);
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setCoverReady(true);
          return;
        }
        if (e instanceof ApiError && e.status === 401) {
          setUnpaired(true);
          return;
        }
        timer = window.setTimeout(() => void load(), RETRY_MS);
        return;
      }

      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
      } catch {
        URL.revokeObjectURL(url);
        if (!cancelled) setCoverReady(true);
        return;
      }
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setCoverUrl(url);
      setCoverReady(true);
    };

    void load();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [eventId, api]);

  useEffect(() => {
    // connect companion stream (mode=kiosk)
    const url = `${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/events/${eventId}/companion/streams?mode=kiosk`;

    // onerror only fires when the socket actually closes. A middlebox that
    // holds the connection half-open (a captive portal, or docker's userland
    // proxy in dev) keeps the browser fooled forever, so treat 35s without a
    // heartbeat as lost. The server emits one every 15s.
    let lastSeen = Date.now();
    let es: EventSource | null = null;
    let stopped = false;

    const connect = () => {
      es?.close();
      const next = new EventSource(url, { withCredentials: true });
      es = next;
      esRef.current = next;
      lastSeen = Date.now();

      next.onopen = () => {
        lastSeen = Date.now();
        setStreamStatus("connected");
      };
      next.onerror = () => {
        lastSeen = Date.now();
        setStreamStatus("lost");
        if (stopped) return;
        // Rotate closes the stream. The browser hides the status code, so
        // confirm with the display endpoint before calling the device unpaired.
        void api
          .get<Display>(`/api/events/${eventId}/companion/display`)
          .catch((e: unknown) => {
            if (stopped || !(e instanceof ApiError) || e.status !== 401) return;
            stopped = true;
            // Close the live connection, which may be a newer retry than
            // the one whose handler is running.
            esRef.current?.close();
            next.close();
            if (watchdogRef.current !== null) {
              window.clearInterval(watchdogRef.current);
              watchdogRef.current = null;
            }
            setUnpaired(true);
          });
      };

      next.onmessage = (ev) => {
        lastSeen = Date.now();
        try {
          const parsed = JSON.parse(ev.data);
          if (
            parsed.eventType === "CHANGE_MODE" &&
            typeof parsed.data?.value === "string"
          ) {
            setDisplay((d) => (d ? { ...d, mode: parsed.data.value } : d));
            // Closing the booth drops whatever result is up, so reopening
            // cannot flash it.
            if (parsed.data.value === "disabled") setScanResult(null);
          }
          if (
            parsed.eventType === "ATTENDANCE" &&
            parsed.type === "NOTIFICATION"
          ) {
            const data = parsed.data;
            const own = ownCheckinRef.current;
            // Don't replay a full-screen success for a check-in this kiosk just
            // performed itself (dialog self-echo after it closes).
            if (own && own.name === data.name && Date.now() - own.ts < 5000) {
              return;
            }
            const confirm = pendingConfirmRef.current;
            if (confirm) {
              // The confirm screen owns this guest: its own result card is
              // already showing, so never downgrade it to a banner — including
              // when the SSE echo beats the POST response back to the browser.
              if (confirm.name === data.name) return;
              // Someone else checked in meanwhile: keep their name on screen
              // without disturbing the confirmation.
              setBanner(`${data.name} checked in`);
              if (bannerTimerRef.current !== null) {
                window.clearTimeout(bannerTimerRef.current);
              }
              bannerTimerRef.current = window.setTimeout(
                () => setBanner(null),
                2500,
              );
              return;
            }
            // A phone/email dialog is mid-entry: banner behind the dialog.
            if (dialogRef.current) {
              setBanner(`${data.name} checked in`);
              if (bannerTimerRef.current !== null) {
                window.clearTimeout(bannerTimerRef.current);
              }
              bannerTimerRef.current = window.setTimeout(
                () => setBanner(null),
                2500,
              );
              return;
            }
            // Idle kiosk: full-screen check-in success, original booth style.
            setBanner(null);
            setScanResult({
              key: ++scanSeqRef.current,
              phase: "success",
              result: {
                success: true,
                detail: {
                  title: data.title ?? null,
                  name: data.name,
                },
              },
            });
          }
          if (
            parsed.eventType === "SCAN_REFUSAL" &&
            parsed.type === "NOTIFICATION"
          ) {
            // Busy or closed booth leaves the verdict on the staff phone.
            if (
              displayRef.current?.mode === "disabled" ||
              dialogRef.current !== null ||
              pendingConfirmRef.current !== null
            ) {
              return;
            }
            const data = parsed.data;
            if (typeof data?.reason !== "string") return;
            setBanner(null);
            setScanResult({
              key: ++scanSeqRef.current,
              phase: "error",
              result: {
                success: false,
                detail: {
                  reason: data.reason,
                  title: data.title ?? null,
                  name: data.name ?? null,
                },
              },
            });
          }
          if (parsed.eventType === "CONTROL") {
            if (parsed.data?.command === "SHOW_CONFIRMATION") {
              const p = parsed.data.params || {};
              // A confirm request takes over the screen; drop whatever the guest
              // was doing so it cannot re-appear behind the result.
              setDialog(null);
              setScanResult(null);
              setPendingConfirm({
                participantId: String(p.participantId ?? ""),
                title: p.title ?? null,
                name: p.name ?? "",
                countryCode: p.countryCode ?? null,
                phone: p.phone ?? null,
                email: p.email ?? null,
              });
            }
            if (
              parsed.data?.command === "CLOSE" ||
              parsed.data?.command === "REFRESH"
            ) {
              window.location.reload();
            }
          }
        } catch {
          // ignore
        }
      };
    };

    connect();
    watchdogRef.current = window.setInterval(() => {
      if (Date.now() - lastSeen > 35000) {
        setStreamStatus("lost");
        // A half-open socket never errors on its own, so force a fresh
        // attempt instead of waiting for the browser to notice.
        connect();
      }
    }, 5000);

    return () => {
      stopped = true;
      es?.close();
      if (watchdogRef.current !== null) {
        window.clearInterval(watchdogRef.current);
      }
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, [eventId, api]);

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
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          This device is not paired.
        </Typography>
        <Typography color="textSecondary" sx={{ fontWeight: 500 }}>
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
      <KioskDisabledScreen
        eventName={display.eventName}
        status={streamStatus}
        battery={battery}
      />
    );
  }

  if (scanResult) {
    return (
      // Full-screen wrapper mirrors the fullScreen Dialog the phone/email
      // workflows render inside, so both success screens are identical.
      <Box sx={{ height: "100dvh", bgcolor: "background.paper" }}>
        <CheckinResultDisplay
          key={scanResult.key}
          phase={scanResult.phase}
          result={scanResult.result}
          onDismiss={() => setScanResult(null)}
        />
      </Box>
    );
  }

  if (pendingConfirm) {
    return (
      <AssistedConfirmationDialog
        eventId={eventId}
        participantId={pendingConfirm.participantId}
        title={pendingConfirm.title}
        name={pendingConfirm.name}
        countryCode={pendingConfirm.countryCode}
        phone={pendingConfirm.phone}
        email={pendingConfirm.email}
        accentColor={accentColor ?? "#000000"}
        onOwnCheckin={markOwnCheckin}
        onClose={closeConfirm}
      />
    );
  }

  const accentSx = accentColor
    ? { bgcolor: accentColor, "&:hover": { bgcolor: accentColor } }
    : undefined;

  return (
    <Box sx={{ display: "flex", height: "100dvh" }}>
      {/* Left: cover, natural aspect, full height, capped at half the width */}
      {coverUrl && (
        <Box
          sx={{
            maxWidth: "50%",
            flex: "0 0 auto",
            alignSelf: "stretch",
            overflow: "hidden",
            bgcolor: "#111",
          }}
        >
          <img
            src={coverUrl}
            alt=""
            style={{ height: "100%", width: "auto", display: "block" }}
          />
        </Box>
      )}

      {/* Right */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 6,
        }}
      >
        {banner && (
          <Typography sx={{ fontWeight: 500, color: "success.main" }}>
            {banner}
          </Typography>
        )}
        <Stack spacing={1.5}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              color: accentColor,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
          >
            {display?.eventName}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {display?.kioskMessage}
          </Typography>
        </Stack>

        <Stack spacing={2} sx={{ width: "100%", maxWidth: 420, mt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            Cannot scan QR code?
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<PhoneAndroidIcon fontSize="inherit" />}
            onClick={() => setDialog("phone")}
            sx={{ height: "70px", py: 1, fontSize: "1.5rem", ...accentSx }}
          >
            Check in with phone No.
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={<EmailIcon fontSize="inherit" />}
            onClick={() => setDialog("email")}
            sx={{ height: "70px", py: 1, fontSize: "1.5rem", ...accentSx }}
          >
            Check in with email
          </Button>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <TouchAppOutlinedIcon fontSize="medium" />
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Tap an option on the screen to continue
            </Typography>
          </Stack>
        </Stack>

        <KioskStatusLine
          status={streamStatus}
          mode={display?.mode}
          battery={battery}
          warn={dialog === null}
        />
      </Box>

      {dialog === "phone" && (
        <KioskPhoneDialog
          open
          eventId={eventId}
          accentColor={accentColor ?? "#000000"}
          onClose={closeDialog}
          onOwnCheckin={markOwnCheckin}
          onUnpaired={() => setUnpaired(true)}
        />
      )}
      {dialog === "email" && (
        <KioskEmailDialog
          open
          eventId={eventId}
          accentColor={accentColor ?? "#000000"}
          onClose={closeDialog}
          onOwnCheckin={markOwnCheckin}
          onUnpaired={() => setUnpaired(true)}
        />
      )}

      <CompanionAdminSessionAlert show={adminCleared} />
    </Box>
  );
}
