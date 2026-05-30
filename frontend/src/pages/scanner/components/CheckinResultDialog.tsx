import { Dialog } from "@mui/material";
import CheckinResultDisplay from "./CheckinResultDisplay";

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

type CheckinPhase = "idle" | "loading" | "success" | "error";

interface Props {
  open: boolean;
  phase: CheckinPhase;
  result: CheckinResponse | null;
  onDismiss: () => void;
}

export default function CheckinResultDialog({
  open,
  phase,
  result,
  onDismiss,
}: Props) {
  if (phase === "idle") return null;

  return (
    <Dialog open={open} fullScreen>
      <CheckinResultDisplay
        phase={phase}
        result={result}
        onDismiss={onDismiss}
      />
    </Dialog>
  );
}
