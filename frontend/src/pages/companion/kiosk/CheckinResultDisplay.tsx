import { useEffect } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import useSound from "use-sound";
import successSound from "@/assets/soundEffects/checkin_success.aac";
import failSound from "@/assets/soundEffects/checkin_fail.aac";
import { useConfetti } from "@/hooks/useConfetti";
import { isErrorDetail, isSuccessDetail, type CheckinResponse } from "./types";

interface Props {
  phase: "loading" | "success" | "error";
  result: CheckinResponse | null;
  errorMessage?: string;
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
  onDismiss,
}: Props) {
  const [playSuccess] = useSound(successSound);
  const [playFail] = useSound(failSound);
  const { fire: fireConfetti } = useConfetti();

  useEffect(() => {
    if (phase === "success") {
      playSuccess();
      fireConfetti();
    }
    if (phase === "error") playFail();
  }, [phase, playSuccess, playFail, fireConfetti]);

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
          <CircularProgress size={LOADING_SIZE} />
          <Typography variant="h2" sx={{ fontWeight: 500 }}>
            Just a moment...
          </Typography>
        </>
      )}
      {phase === "success" &&
        result?.success &&
        isSuccessDetail(result.detail) && (
          <>
            <CheckCircleIcon
              sx={{ fontSize: RESULT_ICON_SIZE, color: "success.main" }}
            />
            <Typography variant="h2" sx={{ fontWeight: 500 }}>
              Welcome
            </Typography>
            <Typography variant="h1" sx={{ fontWeight: 900 }}>
              {result.detail.title ? `${result.detail.title} ` : ""}
              {result.detail.name}
            </Typography>
          </>
        )}
      {phase === "error" && (
        <>
          <ErrorIcon sx={{ fontSize: RESULT_ICON_SIZE, color: "error.main" }} />
          <Typography variant="h2" sx={{ fontWeight: 500 }}>
            {errorDetail?.reason ?? (errorMessage || "Unknown error")}
          </Typography>
          {errorDetail?.name && (
            <Typography variant="h1" sx={{ fontWeight: 900 }}>
              {errorDetail.title ? `${errorDetail.title} ` : ""}
              {errorDetail.name}
            </Typography>
          )}
        </>
      )}
      {phase !== "loading" && (
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
            Tap the screen to close
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
