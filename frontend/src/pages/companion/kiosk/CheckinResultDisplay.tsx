import { useEffect } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import successSound from "@/assets/soundEffects/kiosk_checkin_success.aac";
import failSound from "@/assets/soundEffects/kiosk_error.aac";
import { useConfetti } from "@/hooks/useConfetti";
import { playSound } from "../sounds";
import { type CheckinResponse, isErrorDetail, isSuccessDetail } from "./types";
import { accentOnSurface } from "./kioskStyles";

interface Props {
  phase: "loading" | "success" | "error";
  result: CheckinResponse | null;
  errorMessage?: string;
  accentColor?: string;
  onDismiss: () => void;
}

const RESULT_ICON_SIZE = 128;
const LOADING_SIZE = 96;
const DISMISS_DELAY_MS = 5000;
const RESULT_CONTAINER_SX = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: 4,
  p: 4,
} as const;

export default function CheckinResultDisplay({
  phase,
  result,
  errorMessage = "",
  accentColor,
  onDismiss,
}: Props) {
  const { fire: fireConfetti } = useConfetti();

  useEffect(() => {
    if (phase === "success") {
      playSound(successSound);
      fireConfetti();
    }
    if (phase === "error") playSound(failSound);
  }, [phase, fireConfetti]);

  useEffect(() => {
    if (phase === "loading") return;
    const timer = setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, onDismiss]);

  const errorDetail =
    phase === "error" &&
    result &&
    !result.success &&
    isErrorDetail(result.detail)
      ? result.detail
      : null;

  return (
    <Box
      sx={{
        ...RESULT_CONTAINER_SX,
        cursor: phase === "loading" ? "default" : "pointer",
      }}
      onClick={phase === "loading" ? undefined : onDismiss}
    >
      {phase === "loading" && (
        <>
          <CircularProgress
            size={LOADING_SIZE}
            sx={{
              color: accentColor ? accentOnSurface(accentColor) : undefined,
            }}
          />
          <Typography variant="kioskResultTitle">Just a moment...</Typography>
        </>
      )}
      {phase === "success" &&
        result?.success &&
        isSuccessDetail(result.detail) && (
          <>
            <CheckCircleIcon
              sx={{ fontSize: RESULT_ICON_SIZE, color: "success.main" }}
            />
            <Typography variant="kioskResultTitle">Welcome</Typography>
            <Typography variant="kioskName">
              {result.detail.title ? `${result.detail.title} ` : ""}
              {result.detail.name}
            </Typography>
          </>
        )}
      {phase === "error" && (
        <>
          <ErrorIcon sx={{ fontSize: RESULT_ICON_SIZE, color: "error.main" }} />
          <Typography variant="kioskResultHeading">
            {errorDetail?.reason ?? (errorMessage || "Unknown error")}
          </Typography>
          {errorDetail?.name && (
            <Typography variant="kioskName">
              {errorDetail.title ? `${errorDetail.title} ` : ""}
              {errorDetail.name}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
