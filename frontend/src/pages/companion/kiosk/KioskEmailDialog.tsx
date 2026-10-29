import { useState } from "react";
import { kioskContainedSx, kioskInputSx, kioskOutlinedSx } from "./kioskStyles";
import {
  Box,
  Button,
  Dialog,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import CheckIcon from "@mui/icons-material/Check";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { ApiError, useCompanionApi } from "@/api";
import CheckinResultDisplay from "./CheckinResultDisplay";
import ConflictPickerDialog from "./ConflictPickerDialog";
import useIdleDismiss from "./useIdleDismiss";
import {
  isConflictDetail,
  isSuccessDetail,
  type CheckinPhase,
  type CheckinResponse,
  type ConflictParticipant,
} from "./types";

interface Props {
  open: boolean;
  eventId: string;
  accentColor: string;
  onClose: () => void;
  onOwnCheckin?: (name: string) => void;
  onUnpaired?: () => void;
}

const EMAIL_ICON_SIZE = 96;
const FIELD_MAX_WIDTH = 480;
const EMAIL_KEY_FONT_SIZE = "clamp(1.1rem, 4.2vmin, 2rem)";

// Dedicated layout: number row (emails can contain digits), qwerty, and
// @ . _ - + on the home row end. No space key — an address cannot contain one.
const EMAIL_LAYOUT = {
  default: [
    "1 2 3 4 5 6 7 8 9 0 - + {bksp}",
    "q w e r t y u i o p",
    "a s d f g h j k l",
    "z x c v b n m . _ @",
  ],
};

const EMAIL_DISPLAY = {
  "{bksp}": "⌫",
};

export default function KioskEmailDialog({
  open,
  eventId,
  accentColor,
  onClose,
  onOwnCheckin,
  onUnpaired,
}: Props) {
  const api = useCompanionApi();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<CheckinPhase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [conflicting, setConflicting] = useState<ConflictParticipant[]>([]);
  const bumpIdle = useIdleDismiss(onClose, phase === "input");

  const handleSubmit = async () => {
    if (!email) return;
    setPhase("loading");
    try {
      const data = await api.post<CheckinResponse>(
        `/api/events/${eventId}/companion/checkin/email`,
        { email: email.trim().toLowerCase() },
      );
      if (!data.success && isConflictDetail(data.detail)) {
        setConflicting(data.detail.conflictingParticipants);
        setPhase("multiple");
        return;
      }
      setResult(data);
      setPhase(data.success ? "success" : "error");
      if (data.success && isSuccessDetail(data.detail)) {
        onOwnCheckin?.(data.detail.name);
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 401) {
        onUnpaired?.();
        return;
      }
      setErrorMessage(e instanceof Error ? e.message : "Check-in failed");
      setPhase("error");
    }
  };

  const handleConflictClose = () => {
    setPhase("input");
    setConflicting([]);
    onClose();
  };

  return (
    <Dialog open={open} fullScreen transitionDuration={0}>
      {phase === "multiple" ? (
        <ConflictPickerDialog
          open
          eventId={eventId}
          accentColor={accentColor}
          participants={conflicting}
          onClose={handleConflictClose}
        />
      ) : phase !== "input" ? (
        <CheckinResultDisplay
          phase={phase}
          result={result}
          errorMessage={errorMessage}
          accentColor={accentColor}
          onDismiss={onClose}
        />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <Stack
            spacing={5}
            sx={{
              flex: "1 1 0",
              minHeight: 0,
              alignItems: "center",
              justifyContent: "center",
              p: 4,
            }}
          >
            <EmailIcon sx={{ fontSize: EMAIL_ICON_SIZE, color: accentColor }} />
            <Typography variant="kioskInstruction" sx={{ textAlign: "center" }}>
              Enter the email you registered for this event
            </Typography>
            <Stack
              spacing={3}
              sx={{
                width: "100%",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <TextField
                value={email}
                placeholder="name@example.com"
                variant="standard"
                sx={{
                  width: "100%",
                  maxWidth: FIELD_MAX_WIDTH,
                  ...kioskInputSx(accentColor),
                }}
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontSize: 28, textAlign: "center" },
                  },
                }}
              />
              <Stack
                direction="row"
                spacing={2}
                sx={{ width: "100%", maxWidth: FIELD_MAX_WIDTH }}
              >
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<CloseIcon />}
                  onClick={onClose}
                  sx={{
                    flex: 1,
                    py: 1.5,
                    fontSize: "1.2rem",
                    ...kioskOutlinedSx(),
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<CheckIcon />}
                  disabled={!email}
                  onClick={handleSubmit}
                  sx={{
                    flex: 1,
                    py: 1.5,
                    fontSize: "1.2rem",
                    ...kioskContainedSx(accentColor),
                  }}
                >
                  Check In
                </Button>
              </Stack>
            </Stack>
          </Stack>
          <Box
            sx={{
              flex: "0 0 40%",
              minHeight: 0,
              width: "100%",
              // The library ships .hg-button at height 40px / width 20px and
              // caps the @ key at max-width 60px. Vite injects the library CSS
              // after Emotion, so the selector must be longer than the library's
              // own to win.
              "& .simple-keyboard": {
                height: "100%",
                padding: 0,
                display: "flex",
                flexDirection: "column",
              },
              "& .hg-rows": {
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                // Breathing room so keys are not flush against the keyboard's
                // own top/bottom/left/right edges.
                padding: "8px",
              },
              "& .hg-row": { flex: 1, minHeight: 0 },
              "& .simple-keyboard.hg-theme-default .hg-button": {
                height: "100%",
                width: "auto",
                minWidth: 0,
                maxWidth: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: EMAIL_KEY_FONT_SIZE,
              },
            }}
          >
            <Keyboard
              layout={EMAIL_LAYOUT}
              display={EMAIL_DISPLAY}
              onChange={(input: string) => {
                setEmail(input);
                bumpIdle();
              }}
            />
          </Box>
        </Box>
      )}
    </Dialog>
  );
}
