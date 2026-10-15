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
import { useSystemClock } from "@/providers/useSystemClock";
import KioskPhoneDialog from "./kiosk/KioskPhoneDialog";
import KioskEmailDialog from "./kiosk/KioskEmailDialog";
import AssistedConfirmationDialog from "./kiosk/AssistedConfirmationDialog";
import CheckinResultDisplay from "./kiosk/CheckinResultDisplay";
import type { CheckinResponse } from "./kiosk/types";

interface Display {
  eventName: string;
  kioskMessage: string;
  mode: string;
}

type DialogKind = "phone" | "email" | null;

type ResultPhase = "loading" | "success" | "error";
type StreamStatus = "connecting" | "connected" | "lost";

const KIOSK_DISABLED_SX = {
  height: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 3,
  p: 4,
} as const;

function KioskDisabledScreen({ eventName }: { eventName?: string }) {
  return (
    <Box sx={KIOSK_DISABLED_SX}>
      <NoMeetingRoomIcon sx={{ fontSize: 200 }} />
      <Typography variant="h3" sx={{ fontWeight: 700 }}>
        Check-in will open shortly
      </Typography>
      <Typography variant="h5" sx={{ opacity: 0.75, maxWidth: 900 }}>
        Please wait until the host opens check-in{" "}
        {eventName ? `for ${eventName}` : ""}.
      </Typography>
    </Box>
  );
}

// Bottom-right stream status: test-mode indicator, live indicator, then the
// wall clock.
function KioskStatusLine({
  status,
  mode,
}: {
  status: StreamStatus;
  mode?: string;
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
        color: "text.primary",
      }}
    >
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
  const { eventId } = useParams({
    from: "/full-page/companion/events/$eventId/kiosk" as unknown as any, // eslint-disable-line
  });
  const api = useCompanionApi();
  const navigate = useNavigate();
  const [display, setDisplay] = useState<Display | null>(null);
  const [unpaired, setUnpaired] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [scanResult, setScanResult] = useState<{
    phase: ResultPhase;
    result: CheckinResponse;
  } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(true);
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

  // Clear any admin session lingering on this guest-facing browser.
  // 401s when no session exists; that case is a harmless no-op.
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_API_URL ?? ""}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<Display>(
          `/api/events/${eventId}/companion/display`,
        );
        setDisplay(d);
      } catch (e: unknown) {
        if (e instanceof ApiError && e.status === 401) {
          setUnpaired(true);
        }
      }
      try {
        const c = await api.get<{ colorCode: string }>(
          `/api/events/${eventId}/companion/accentColor`,
        );
        setAccentColor(c.colorCode);
      } catch {
        // keep theme default
      }
    })();
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
              phase: "success",
              result: {
                success: true,
                detail: {
                  title: displayRef.current?.eventName ?? null,
                  name: data.name,
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
    return <KioskDisabledScreen eventName={display.eventName} />;
  }

  if (scanResult) {
    return (
      // Full-screen wrapper mirrors the fullScreen Dialog the phone/email
      // workflows render inside, so both success screens are identical.
      <Box sx={{ height: "100dvh", bgcolor: "background.paper" }}>
        <CheckinResultDisplay
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
      {hasImage && (
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
            src={`/api/events/${eventId}/companion/boothImage`}
            alt=""
            style={{ height: "100%", width: "auto", display: "block" }}
            onLoad={() => setHasImage(true)}
            onError={() => setHasImage(false)}
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
          gap: 3,
        }}
      >
        {banner && (
          <Typography sx={{ color: "success.main" }}>{banner}</Typography>
        )}

        <Typography variant="h2" sx={{ fontWeight: 900, color: accentColor }}>
          {display?.eventName}
        </Typography>
        <Typography variant="h5" sx={{ whiteSpace: "pre-wrap", maxWidth: 720 }}>
          {display?.kioskMessage}
        </Typography>

        <Stack spacing={2} sx={{ width: "100%", maxWidth: 420, mt: 2 }}>
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
              mt: 1,
              px: 4,
            }}
          >
            <TouchAppOutlinedIcon fontSize="medium" />
            <Typography variant="body1">
              Tap an option on the screen to continue.
            </Typography>
          </Stack>
        </Stack>

        <KioskStatusLine status={streamStatus} mode={display?.mode} />
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
    </Box>
  );
}
