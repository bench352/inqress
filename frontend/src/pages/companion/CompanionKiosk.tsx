import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Stack, ThemeProvider, Typography } from "@mui/material";

import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useParams } from "@tanstack/react-router";
import DoorSlidingOutlinedIcon from "@mui/icons-material/DoorSlidingOutlined";
import { ApiError, useCompanionApi } from "@/api";
import { useBootHold } from "@/components/bootHold";
import { useSystemClock } from "@/providers/useSystemClock";
import successSound from "@/assets/soundEffects/kiosk_checkin_success.aac";
import failSound from "@/assets/soundEffects/kiosk_error.aac";
import confirmSound from "@/assets/soundEffects/kiosk_confirmation_needed.aac";
import lowBatterySound from "@/assets/soundEffects/companion_battery_low.aac";
import CoverScreen from "./kiosk/CoverScreen";
import ScanNotice from "./kiosk/ScanNotice";
import { playSound, useSounds } from "./sounds";
import KioskPhoneDialog from "./kiosk/KioskPhoneDialog";
import KioskEmailDialog from "./kiosk/KioskEmailDialog";
import AssistedConfirmationDialog from "./kiosk/AssistedConfirmationDialog";
import CheckinResultDisplay from "./kiosk/CheckinResultDisplay";
import type { CheckinResponse } from "./kiosk/types";
import CompanionAdminSessionAlert from "./CompanionAdminSessionAlert";
import useClearAdminSession from "./useClearAdminSession";
import BatteryIndicator, { LowBatteryAlert } from "./BatteryIndicator";
import useBattery, { type BatteryState, batteryAlertOpen } from "./useBattery";
import { useKioskTheme } from "./kiosk/kioskStyles";

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
// Weights must match the @font-face rules imported by the app, or the face is
// not loaded.
const KIOSK_FONTS = [
  '400 16px "Roboto Condensed"',
  '700 16px "Roboto Condensed"',
  '500 16px "Roboto"',
  '700 16px "Roboto"',
] as const;

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
  const headline = "Check-in will open shortly";
  const subtitle = `Please wait until the host opens check-in${eventName ? ` for ${eventName}` : ""}.`;
  return (
    <Box sx={KIOSK_DISABLED_SX}>
      <DoorSlidingOutlinedIcon sx={{ fontSize: 200 }} />
      <Typography variant="kioskHeadline">{headline}</Typography>
      <Typography variant="kioskSubtitle" color="textSecondary">
        {subtitle}
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
}: {
  status: StreamStatus;
  mode?: string;
  battery: BatteryState | null;
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
      <BatteryIndicator battery={battery} />
      {mode === "test" && (
        <ScienceOutlinedIcon fontSize="medium" color="warning" />
      )}
      {connected ? (
        <CloudDoneOutlinedIcon fontSize="medium" sx={{ color: "#000" }} />
      ) : (
        <CloudOffOutlinedIcon fontSize="medium" color="error" />
      )}
      <Typography variant="kioskClock">{time}</Typography>
    </Stack>
  );
}

export default function CompanionKiosk() {
  const { eventId } = useParams({ strict: false }) as { eventId: string };
  const api = useCompanionApi();
  const [display, setDisplay] = useState<Display | null>(null);
  const [unpaired, setUnpaired] = useState(false);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [scanResult, setScanResult] = useState<{
    key: number;
    phase: ResultPhase;
    result: CheckinResponse;
  } | null>(null);
  // A scan result shown beside an open dialog instead of over it.
  const [notice, setNotice] = useState<{
    key: number;
    result: CheckinResponse;
  } | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverReady, setCoverReady] = useState(false);
  const [accentReady, setAccentReady] = useState(false);
  const [displayReady, setDisplayReady] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [fontsReady, setFontsReady] = useState(false);
  const [phoneCountryCodes, setPhoneCountryCodes] = useState<string[]>([]);
  const [phoneCountryDefaultCode, setPhoneCountryDefaultCode] = useState("");
  const [codesReady, setCodesReady] = useState(false);

  const kioskTheme = useKioskTheme();

  // Casual selection lock while kiosk is mounted (polish only; kiosk mode + staff are the real boundary)
  useEffect(() => {
    const style = document.body.style as CSSStyleDeclaration & {
      WebkitUserSelect?: string;
    };
    const prev = style.userSelect;
    const prevWebkit = style.WebkitUserSelect;
    style.userSelect = "none";
    style.WebkitUserSelect = "none";
    // Chrome won't paint a ::before resolving to user-select: none, and MUI
    // draws the standard input underline with ::before.
    const underline = document.createElement("style");
    underline.textContent =
      ".MuiInputBase-root::before { -webkit-user-select: text; user-select: text; }";
    document.head.appendChild(underline);
    return () => {
      style.userSelect = prev;
      style.WebkitUserSelect = prevWebkit;
      underline.remove();
    };
  }, []);
  const [pendingConfirm, setPendingConfirm] = useState<{
    participantId: string;
    title: string | null;
    name: string;
    countryCode: string | null;
    phone: string | null;
    email: string | null;
  } | null>(null);
  // Remounts the confirm dialog so its clock, screen, and chime start over for
  // each request, even for the same guest.
  const [confirmSeq, setConfirmSeq] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const dialogRef = useRef<DialogKind>(null);
  const displayRef = useRef<Display | null>(null);
  const pendingConfirmRef = useRef<typeof pendingConfirm>(null);
  const ownCheckinRef = useRef<{ name: string; ts: number } | null>(null);
  const scanSeqRef = useRef(0);
  const noticeSeqRef = useRef(0);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);
  const closeConfirm = useCallback(() => {
    setPendingConfirm(null);
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
  // The only thing that pauses the booth: the card is modal, the scan notice is not.
  const batteryOpen = batteryAlertOpen(battery);
  const soundsReady = useSounds(KIOSK_SOUNDS);

  // Preload the faces the booth paints so the first frame cannot flash a
  // fallback font; finally (not then) so a failed face cannot pin the boot
  // screen forever.
  useEffect(() => {
    let cancelled = false;
    Promise.all(KIOSK_FONTS.map((f) => document.fonts.load(f))).finally(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const boothReady =
    displayReady &&
    accentReady &&
    coverReady &&
    soundsReady &&
    fontsReady &&
    codesReady;
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

  // One fetch, two callers: the boot retry loop and the refresh-on-open.
  const fetchCodes = useCallback(async (): Promise<string[]> => {
    const res = await api.get<{ default: string; options: string[] }>(
      `/api/events/${eventId}/companion/phones/countryCodes`,
    );
    const options = res.options ?? [];
    setPhoneCountryCodes(options);
    setPhoneCountryDefaultCode(res.default);
    return options;
  }, [api, eventId]);

  // Load available phone country codes so we can decide whether to offer the
  // "check in with phone number" option (hide it entirely when no participants
  // have a phone number). An empty options list is a success: the event simply
  // has no phone numbers.
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const load = async () => {
      try {
        await fetchCodes();
        if (cancelled) return;
        setCodesReady(true);
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
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
  }, [fetchCodes]);

  // Boot load only decides the button. Refresh on open so a code added after
  // the kiosk started is in the list. A failure keeps the list already shown.
  useEffect(() => {
    if (dialog !== "phone") return;
    let cancelled = false;
    void (async () => {
      try {
        const options = await fetchCodes();
        if (cancelled) return;
        if (options.length === 0) closeDialog();
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) setUnpaired(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialog, fetchCodes, closeDialog]);

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
            if (parsed.data.value === "disabled") {
              setScanResult(null);
              setNotice(null);
            }
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
            const result: CheckinResponse = {
              success: true,
              detail: { title: data.title ?? null, name: data.name },
            };
            const confirm = pendingConfirmRef.current;
            if (confirm && confirm.name === data.name) {
              // Staff scanned the guest the confirm screen is holding: that
              // screen is superseded, so close it and take the whole booth.
              setPendingConfirm(null);
              setNotice(null);
              setScanResult({
                key: ++scanSeqRef.current,
                phase: "success",
                result,
              });
              return;
            }
            if (confirm || dialogRef.current) {
              // Beside the dialog, not over it: the guest keeps their screen,
              // and its clock keeps running.
              playSound(successSound);
              setNotice({ key: ++noticeSeqRef.current, result });
              return;
            }
            // Idle kiosk: full-screen check-in success, whose own sound plays.
            setNotice(null);
            setScanResult({
              key: ++scanSeqRef.current,
              phase: "success",
              result,
            });
          }
          if (
            parsed.eventType === "SCAN_REFUSAL" &&
            parsed.type === "NOTIFICATION"
          ) {
            // A closed booth leaves the verdict on the staff phone.
            if (displayRef.current?.mode === "disabled") return;
            const data = parsed.data;
            if (typeof data?.reason !== "string") return;
            const result: CheckinResponse = {
              success: false,
              detail: {
                reason: data.reason,
                title: data.title ?? null,
                name: data.name ?? null,
              },
            };
            const confirm = pendingConfirmRef.current;
            const sameGuest =
              !!confirm &&
              typeof data.name === "string" &&
              confirm.name === data.name;
            if (sameGuest) {
              setPendingConfirm(null);
              setNotice(null);
              setScanResult({
                key: ++scanSeqRef.current,
                phase: "error",
                result,
              });
              return;
            }
            if (confirm || dialogRef.current) {
              playSound(failSound);
              setNotice({ key: ++noticeSeqRef.current, result });
              return;
            }
            setNotice(null);
            setScanResult({
              key: ++scanSeqRef.current,
              phase: "error",
              result,
            });
          }
          if (parsed.eventType === "CONTROL") {
            if (parsed.data?.command === "SHOW_CONFIRMATION") {
              const p = parsed.data.params || {};
              // A confirm request takes over the screen; drop whatever the guest
              // was doing so it cannot re-appear behind the result.
              setDialog(null);
              setScanResult(null);
              setNotice(null);
              setConfirmSeq((n) => n + 1);
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
    };
  }, [eventId, api]);

  const renderScreen = () => {
    if (unpaired) {
      return (
        <Box sx={KIOSK_DISABLED_SX}>
          {/* For a potentially unattended device, it's better to keep the error message
             stuck without a way to "escape" out of it */}
          <WarningAmberIcon sx={{ fontSize: 200, color: "error.main" }} />
          <Typography color="error" variant="kioskHeadline">
            Sorry, this kiosk is out of service
          </Typography>
          <Typography variant="kioskSubtitle">
            A technical issue has stopped the kiosk from working.
            <br />
            Please reach out to administrator for assistance.
          </Typography>
          <Typography variant="body1" color="textSecondary">
            (Detail: The pairing token was rotated or the event was removed)
          </Typography>
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
        <Box sx={{ height: "100dvh", bgcolor: "background.paper" }}>
          {/* Full-screen wrapper mirrors the fullScreen Dialog the phone/email
             workflows render inside, so both success screens are identical. */}
          <CheckinResultDisplay
            key={scanResult.key}
            phase={scanResult.phase}
            result={scanResult.result}
            accentColor={accentColor ?? undefined}
            onDismiss={() => setScanResult(null)}
          />
        </Box>
      );
    }

    if (pendingConfirm) {
      return (
        <AssistedConfirmationDialog
          key={confirmSeq}
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
          paused={batteryOpen}
        />
      );
    }

    return (
      <Box sx={{ display: "flex", height: "100dvh" }}>
        <CoverScreen
          eventName={display?.eventName}
          message={display?.kioskMessage}
          accentColor={accentColor}
          coverUrl={coverUrl}
          onPhone={
            phoneCountryCodes.length > 0 ? () => setDialog("phone") : undefined
          }
          onEmail={() => setDialog("email")}
          footer={
            <KioskStatusLine
              status={streamStatus}
              mode={display?.mode}
              battery={battery}
            />
          }
        />

        {dialog === "phone" && (
          <KioskPhoneDialog
            open
            eventId={eventId}
            accentColor={accentColor ?? "#000000"}
            countryCodes={phoneCountryCodes}
            defaultCountryCode={phoneCountryDefaultCode}
            onClose={closeDialog}
            onOwnCheckin={markOwnCheckin}
            onUnpaired={() => setUnpaired(true)}
            paused={batteryOpen}
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
            paused={batteryOpen}
          />
        )}

        <CompanionAdminSessionAlert show={adminCleared} />
      </Box>
    );
  };

  return (
    <ThemeProvider theme={kioskTheme}>
      {renderScreen()}
      {/* Above every screen, because the screens it sits over unmount. */}
      {battery && (
        <LowBatteryAlert open={batteryOpen} onClose={battery.dismiss} />
      )}
      {notice && (
        <ScanNotice
          key={notice.key}
          notice={notice}
          paused={batteryOpen}
          onDismiss={() => setNotice(null)}
        />
      )}
    </ThemeProvider>
  );
}
