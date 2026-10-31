import { useCallback, useState } from "react";
import { Dialog } from "@mui/material";
import { ApiError, useCompanionApi } from "@/api";
import PhoneCheckinPanel from "./PhoneCheckinPanel";
import CheckinResultDisplay from "./CheckinResultDisplay";
import ConflictPickerDialog from "./ConflictPickerDialog";
import useIdleDismiss from "./useIdleDismiss";
import {
  type CheckinPhase,
  type CheckinResponse,
  type ConflictParticipant,
  isConflictDetail,
  isSuccessDetail,
} from "./types";

interface Props {
  open: boolean;
  eventId: string;
  accentColor: string;
  countryCodes: string[];
  /** The server's default country code for the event. */
  defaultCountryCode: string;
  onClose: () => void;
  onOwnCheckin?: (name: string) => void;
  onUnpaired?: () => void;
  /** The low battery card is in front: freeze the idle countdown. */
  paused?: boolean;
}

export default function KioskPhoneDialog({
  open,
  eventId,
  accentColor,
  countryCodes,
  defaultCountryCode,
  onClose,
  onOwnCheckin,
  onUnpaired,
  paused = false,
}: Props) {
  const api = useCompanionApi();
  const [userSelectedCode, setUserSelectedCode] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState("");
  const [phase, setPhase] = useState<CheckinPhase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [conflicting, setConflicting] = useState<ConflictParticipant[]>([]);
  const bumpIdle = useIdleDismiss(onClose, phase === "input", paused);

  const effectiveDefault =
    countryCodes.includes(defaultCountryCode) && defaultCountryCode
      ? defaultCountryCode
      : (countryCodes[0] ?? "");
  const selectedCountryCode =
    userSelectedCode && countryCodes.includes(userSelectedCode)
      ? userSelectedCode
      : effectiveDefault;

  const handleDigit = useCallback(
    (digit: string) => {
      setPhoneNo((prev) => prev + digit);
      bumpIdle();
    },
    [bumpIdle],
  );

  const handleBackspace = useCallback(() => {
    setPhoneNo((prev) => prev.slice(0, -1));
    bumpIdle();
  }, [bumpIdle]);

  const handleSubmit = async () => {
    if (!phoneNo) return;
    setPhase("loading");
    try {
      const data = await api.post<CheckinResponse>(
        `/api/events/${eventId}/companion/checkin/phone`,
        { countryCode: selectedCountryCode, phoneNo },
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
        <PhoneCheckinPanel
          accentColor={accentColor}
          countryCodes={countryCodes}
          selectedCountryCode={selectedCountryCode}
          phoneNo={phoneNo}
          onCountryCodeChange={(code) => {
            setUserSelectedCode(code);
            bumpIdle();
          }}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onSubmit={handleSubmit}
          onCancel={onClose}
          disabled={false}
          submitDisabled={!phoneNo}
        />
      )}
    </Dialog>
  );
}
