import { useCallback, useEffect, useReducer, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/api.ts";
import { useBoothStream } from "@/hooks/useBoothStream.ts";
import BoothImage from "./components/BoothImage";
import CameraPreview from "./components/CameraPreview";
import CheckinResultDialog from "./components/CheckinResultDialog";
import CheckinByPhoneDialog from "./components/CheckinByPhoneDialog";
import EventDisabledDialog from "./components/EventDisabledDialog";
import BoothRejectedDialog from "./components/BoothRejectedDialog";
import AssistedConfirmationDialog from "./components/AssistedConfirmationDialog";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import type {
  CheckinErrorDetail,
  CheckinPhase,
  CheckinResponse,
} from "./types";

interface AssistedConfirmationData {
  participantId: string;
  title: string | null;
  name: string;
  countryCode: string | null;
  phone: string | null;
  email: string | null;
}

interface EventResponse {
  id: string;
  name: string;
  description: string;
  date: string;
  mode: "disabled" | "test" | "live";
  hasBoothImage: boolean;
}

function showCameraReducer(state: boolean, action: string) {
  switch (action) {
    case "SHOW_CAMERA_PREVIEW":
      return true;
    case "HIDE_CAMERA_PREVIEW":
      return false;
    default:
      return state;
  }
}

type AssistedConfirmationAction =
  | { type: "SET"; payload: AssistedConfirmationData }
  | { type: "CLEAR" };

function assistedConfirmationReducer(
  state: AssistedConfirmationData | null,
  action: AssistedConfirmationAction,
): AssistedConfirmationData | null {
  switch (action.type) {
    case "SET":
      return action.payload;
    case "CLEAR":
      return null;
    default:
      return state;
  }
}

function ScannerInner({ eventId }: { eventId: string }) {
  const api = useApi();

  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneDialogKey, setPhoneDialogKey] = useState(0);
  const [checkinPhase, setCheckinPhase] = useState<CheckinPhase>("idle");
  const [checkinResult, setCheckinResult] = useState<CheckinResponse | null>(
    null,
  );
  const [showCamera, dispatchCamera] = useReducer(showCameraReducer, false);
  const [assistedConfirmation, dispatchAssisted] = useReducer(
    assistedConfirmationReducer,
    null,
  );

  const {
    mode: boothMode,
    controlCommand,
    dismissCommand,
    connectionRejected,
  } = useBoothStream(eventId);

  const scannerPaused =
    checkinPhase !== "idle" || phoneDialogOpen || assistedConfirmation !== null;

  const { data: event } = useQuery<EventResponse>({
    queryKey: ["event", eventId],
    queryFn: () => api.get<EventResponse>(`/api/events/${eventId}`),
  });

  const { data: accentColorData } = useQuery<{ colorCode: string }>({
    queryKey: ["accentColor", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/accentColor`),
  });

  useEffect(() => {
    if (!controlCommand) return;
    switch (controlCommand.command) {
      case "SHOW_CAMERA_PREVIEW":
      case "HIDE_CAMERA_PREVIEW":
        dispatchCamera(controlCommand.command);
        dismissCommand();
        break;
      case "REFRESH":
        window.location.reload();
        break;
      case "CLOSE":
        if (window.opener) {
          window.close();
        } else {
          window.location.href = `/full-page/events/${eventId}`;
        }
        break;
      case "SHOW_CONFIRMATION":
        dispatchAssisted({
          type: "SET",
          payload: {
            participantId: controlCommand.params.participantId as string,
            title: controlCommand.params.title as string | null,
            name: controlCommand.params.name as string,
            countryCode: controlCommand.params.countryCode as string | null,
            phone: controlCommand.params.phone as string | null,
            email: controlCommand.params.email as string | null,
          },
        });
        dismissCommand();
        break;
    }
  }, [controlCommand, dismissCommand, eventId]);

  const finalMode = boothMode ?? event?.mode ?? null;
  const accentColor = accentColorData?.colorCode ?? "#000000";

  const handleScan = useCallback(
    (detectedCodes: { rawValue: string }[]) => {
      if (detectedCodes.length === 0) return;
      const token = detectedCodes[0].rawValue;
      setCheckinPhase("loading");
      api
        .postNoAuth<CheckinResponse>(`/api/events/${eventId}/scan`, {
          ticket: token,
        })
        .then((data) => {
          setCheckinResult(data);
          setCheckinPhase(data.success ? "success" : "error");
        })
        .catch((err) => {
          setCheckinResult({
            success: false,
            detail: { reason: err.message } as CheckinErrorDetail,
          });
          setCheckinPhase("error");
        });
    },
    [eventId, api],
  );

  const handleScanDismiss = useCallback(() => {
    setCheckinPhase("idle");
    setCheckinResult(null);
    dispatchCamera("HIDE_CAMERA_PREVIEW");
  }, []);

  const handlePhoneOpen = useCallback(() => {
    setPhoneDialogOpen(true);
    setPhoneDialogKey((k) => k + 1);
  }, []);

  const handlePhoneClose = useCallback(() => {
    setPhoneDialogOpen(false);
  }, []);

  const handleAssistedConfirmationClose = useCallback(() => {
    dispatchAssisted({ type: "CLEAR" });
  }, []);

  if (connectionRejected) {
    return <BoothRejectedDialog eventId={eventId} />;
  }

  if (finalMode === "disabled" && boothMode !== null) {
    return <EventDisabledDialog />;
  }

  if (!event) return null;

  if (!boothMode && event.mode === "disabled") {
    return <EventDisabledDialog />;
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Box
        sx={{
          height: "100%",
          aspectRatio: "1 / 1",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "grey.200",
          overflow: "hidden",
        }}
      >
        <BoothImage
          key={`${eventId}-${event.hasBoothImage}`}
          eventId={eventId}
          eventName={event.name}
          hasBoothImage={event.hasBoothImage}
        />
      </Box>
      <Box
        sx={{
          width: "50%",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <Box
          sx={{
            aspectRatio: "16 / 9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: showCamera ? "black" : "grey.100",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {showCamera ? (
            <CameraPreview paused={scannerPaused} onScan={handleScan} />
          ) : (
            <>
              <QrCodeScannerIcon sx={{ fontSize: 120, color: accentColor }} />
              <Box
                sx={{
                  position: "fixed",
                  left: -9999,
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              >
                <CameraPreview paused={scannerPaused} onScan={handleScan} />
              </Box>
            </>
          )}
        </Box>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            p: 4,
          }}
        >
          <Typography
            variant="h3"
            color="text.secondary"
            sx={{ textAlign: "center", fontSize: 46, maxWidth: 540 }}
          >
            Present your QR code ticket to the camera to check in
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handlePhoneOpen}
            sx={{
              py: 2,
              px: 4,
              fontSize: "1.8rem",
              bgcolor: accentColor,
              "&:hover": { bgcolor: accentColor },
            }}
          >
            <LoginIcon sx={{ fontSize: 46, pr: 2 }} />
            Check-in without QR Code
          </Button>
        </Box>
      </Box>
      <CheckinResultDialog
        open={checkinPhase !== "idle"}
        phase={checkinPhase}
        result={checkinResult}
        onDismiss={handleScanDismiss}
      />
      {phoneDialogOpen && (
        <CheckinByPhoneDialog
          key={phoneDialogKey}
          open={phoneDialogOpen}
          eventId={eventId}
          accentColor={accentColor}
          onClose={handlePhoneClose}
        />
      )}
      {assistedConfirmation && (
        <AssistedConfirmationDialog
          open
          eventId={eventId}
          participantId={assistedConfirmation.participantId}
          title={assistedConfirmation.title}
          name={assistedConfirmation.name}
          countryCode={assistedConfirmation.countryCode}
          phone={assistedConfirmation.phone}
          email={assistedConfirmation.email}
          accentColor={accentColor}
          onClose={handleAssistedConfirmationClose}
        />
      )}
    </Box>
  );
}

export default function CheckInBooth() {
  const { eventId } = useParams({
    from: "/full-page/events/$eventId/checkInBooth",
  });
  const api = useApi();

  const [statusChecked, setStatusChecked] = useState(false);
  const [boothRejected, setBoothRejected] = useState(false);

  useEffect(() => {
    api
      .get<{ connected: boolean }>(`/api/events/${eventId}/checkInBooth/status`)
      .then((res) => {
        if (res.connected) {
          setBoothRejected(true);
        }
        setStatusChecked(true);
      })
      .catch(() => setStatusChecked(true));
  }, [eventId, api]);

  if (!statusChecked) return null;

  if (boothRejected) return <BoothRejectedDialog eventId={eventId} />;

  return <ScannerInner eventId={eventId} />;
}
