import { useEffect } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import useSound from "use-sound";
import successSound from "../../../assets/soundEffects/checkin_success.aac";
import failSound from "../../../assets/soundEffects/checkin_fail.aac";

interface CheckinSuccessDetail {
  title: string;
  name: string;
}

interface CheckinErrorDetail {
  reason: string;
}

interface CheckinResponse {
  success: boolean;
  detail: CheckinSuccessDetail | CheckinErrorDetail;
}

type CheckinPhase = "loading" | "success" | "error";

interface Props {
  phase: CheckinPhase;
  result: CheckinResponse | null;
  errorMessage?: string;
  onDismiss: () => void;
}

const RESULT_ICON_SIZE = 128;
const LOADING_SIZE = 96;
const DISMISS_DELAY_MS = 3000;

export default function CheckinResultDisplay({
  phase,
  result,
  errorMessage = "",
  onDismiss,
}: Props) {
  const [playSuccess] = useSound(successSound, { volume: 0.5 });
  const [playFail] = useSound(failSound, { volume: 0.5 });

  useEffect(() => {
    if (phase === "success") playSuccess();
    if (phase === "error") playFail();
  }, [phase, playSuccess, playFail]);

  useEffect(() => {
    const timer = setTimeout(onDismiss, DISMISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, onDismiss]);

  return (
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
      {phase === "loading" && (
        <>
          <CircularProgress size={LOADING_SIZE} />
          <Typography variant="h2" color="text.secondary">
            Just a moment...
          </Typography>
        </>
      )}
      {phase === "success" && result?.success && (
        <>
          <CheckCircleIcon
            sx={{ fontSize: RESULT_ICON_SIZE, color: "success.main" }}
          />
          <Typography variant="h2">Welcome</Typography>
          <Typography variant="h1" color="text.secondary">
            {"detail" in result && !("reason" in result.detail)
              ? `${result.detail.title} ${result.detail.name}`
              : ""}
          </Typography>
        </>
      )}
      {phase === "error" && (
        <>
          <ErrorIcon sx={{ fontSize: RESULT_ICON_SIZE, color: "error.main" }} />
          <Typography variant="h2" color="error.main">
            {result && !result.success && "reason" in result.detail
              ? result.detail.reason
              : errorMessage || "Unknown error"}
          </Typography>
        </>
      )}
    </Box>
  );
}
