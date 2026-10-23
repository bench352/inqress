import { useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EmailIcon from "@mui/icons-material/Email";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import PhoneIcon from "@mui/icons-material/Phone";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import useSound from "use-sound";
import confirmSound from "@/assets/soundEffects/checkin_need_confirmation.aac";
import { maskEmail, maskPhone } from "@/utils/masking";
import { useCompanionApi } from "@/api";
import CheckinResultDisplay from "./CheckinResultDisplay";
import type { CheckinResponse } from "./types";

type ConfirmPhase = "input" | "loading" | "success" | "error";

const INITIAL_TIMEOUT_S = 60;

interface Props {
  eventId: string;
  participantId: string;
  title: string | null;
  name: string;
  countryCode: string | null;
  phone: string | null;
  email: string | null;
  accentColor: string;
  onOwnCheckin: (name: string) => void;
  onClose: () => void;
}

export default function AssistedConfirmationDialog({
  eventId,
  participantId,
  title,
  name,
  countryCode,
  phone,
  email,
  accentColor,
  onOwnCheckin,
  onClose,
}: Props) {
  const api = useCompanionApi();
  const [phase, setPhase] = useState<ConfirmPhase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [playConfirm] = useSound(confirmSound);
  const [countdown, setCountdown] = useState(INITIAL_TIMEOUT_S);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(INITIAL_TIMEOUT_S);

  useEffect(() => {
    playConfirm();
  }, [playConfirm]);

  useEffect(() => {
    countdownRef.current = INITIAL_TIMEOUT_S;

    timerRef.current = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onClose]);

  const handleYes = () => {
    setPhase("loading");
    api
      .post<CheckinResponse>(
        `/api/events/${eventId}/companion/checkin/manual`,
        { participantId },
      )
      .then((data) => {
        setResult(data);
        setPhase(data.success ? "success" : "error");
        if (data.success) onOwnCheckin(name);
      })
      .catch((err: unknown) => {
        const detail =
          err && typeof err === "object" && "detail" in err
            ? (err as { detail: unknown }).detail
            : null;
        setResult({
          success: false,
          detail: {
            reason: typeof detail === "string" ? detail : "Check-in failed",
          },
        });
        setPhase("error");
      });
  };
  if (phase !== "input") {
    return (
      <Dialog open fullScreen>
        <CheckinResultDisplay
          phase={phase}
          result={result}
          onDismiss={onClose}
        />
      </Dialog>
    );
  }

  return (
    <Dialog open fullScreen>
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          p: 8,
        }}
      >
        <PersonSearchIcon sx={{ fontSize: 120, color: accentColor }} />
        <Typography variant="h2" sx={{ fontWeight: 500 }}>
          Confirm this is you
        </Typography>
        <Typography variant="h1" sx={{ fontWeight: 900 }}>
          {title ? `${title} ` : ""}
          {name}
        </Typography>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <PhoneIcon fontSize="large" color="action" />
            <Typography variant="h4" sx={{ fontWeight: 500 }}>
              {countryCode && phone
                ? `${countryCode} ${maskPhone(phone)}`
                : "(No phone number)"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <EmailIcon fontSize="large" color="action" />
            <Typography variant="h4" sx={{ fontWeight: 500 }}>
              {email ? maskEmail(email) : "(No email address)"}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={4} sx={{ mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            color="error"
            onClick={onClose}
            startIcon={<CancelIcon />}
            sx={{ py: 2, px: 4, fontSize: "2rem", width: "300px" }}
          >
            No ({countdown}s)
          </Button>
          <Button
            variant="contained"
            size="large"
            color="success"
            onClick={handleYes}
            startIcon={<CheckCircleIcon />}
            sx={{ py: 2, px: 4, fontSize: "2rem", width: "300px" }}
          >
            Yes
          </Button>
        </Stack>

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
            Tap an option on the screen to select
          </Typography>
        </Stack>
      </Box>
    </Dialog>
  );
}
