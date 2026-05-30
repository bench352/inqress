import { Dialog } from "@mui/material";
import CheckinResultDisplay from "./CheckinResultDisplay";
import type { CheckinPhase, CheckinResponse } from "../types";

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
