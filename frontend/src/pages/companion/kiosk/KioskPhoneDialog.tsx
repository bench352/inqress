import { useCallback, useState } from "react";
import { kioskInputSx, kioskOutlinedSx } from "./kioskStyles";
import {
  Box,
  Button,
  Dialog,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CloseIcon from "@mui/icons-material/Close";
import { ApiError, useCompanionApi } from "@/api";
import PhoneDialPad, {
  DIAL_ACTION_FONT_SIZE,
  DIAL_BUTTON_HEIGHT,
  DIAL_PAD_MAX_WIDTH,
} from "./PhoneDialPad";
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
}

const PHONE_ICON_SIZE = 96;
const PHONE_NO_FONT_SIZE = 22;
const FIELD_MAX_WIDTH = DIAL_PAD_MAX_WIDTH;

export default function KioskPhoneDialog({
  open,
  eventId,
  accentColor,
  countryCodes,
  defaultCountryCode,
  onClose,
  onOwnCheckin,
  onUnpaired,
}: Props) {
  const api = useCompanionApi();
  const [userSelectedCode, setUserSelectedCode] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState("");
  const [phase, setPhase] = useState<CheckinPhase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [conflicting, setConflicting] = useState<ConflictParticipant[]>([]);
  const bumpIdle = useIdleDismiss(onClose, phase === "input");

  const effectiveDefault =
    countryCodes.includes(defaultCountryCode) && defaultCountryCode
      ? defaultCountryCode
      : (countryCodes[0] ?? "");
  const selectedCountryCode = userSelectedCode ?? effectiveDefault;

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
        <Box sx={{ display: "flex", height: "100%" }}>
          <Box
            sx={{
              width: "50%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              p: 6,
              bgcolor: "grey.100",
            }}
          >
            <PhoneAndroidIcon
              sx={{ fontSize: PHONE_ICON_SIZE, color: accentColor }}
            />
            <Typography
              variant="kioskInstruction"
              sx={{ textAlign: "center", pt: 4 }}
            >
              Enter the phone number you registered for this event
            </Typography>
          </Box>
          <Box
            sx={{
              width: "50%",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              p: 4,
            }}
          >
            <Stack
              direction="row"
              spacing={3}
              sx={{ width: "100%", maxWidth: FIELD_MAX_WIDTH }}
            >
              <FormControl
                sx={{
                  flex: "0 0 auto",
                  minWidth: 120,
                  ...kioskInputSx(accentColor),
                }}
              >
                <Select
                  value={selectedCountryCode}
                  variant="standard"
                  onChange={(e) => {
                    setUserSelectedCode(e.target.value);
                    bumpIdle();
                  }}
                  sx={{
                    fontSize: PHONE_NO_FONT_SIZE,
                    whiteSpace: "nowrap",
                  }}
                >
                  {countryCodes.map((code) => (
                    <MenuItem
                      key={code}
                      value={code}
                      sx={{
                        fontSize: PHONE_NO_FONT_SIZE,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                variant="standard"
                value={phoneNo}
                sx={kioskInputSx(accentColor)}
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontSize: PHONE_NO_FONT_SIZE },
                  },
                }}
              />
            </Stack>
            <PhoneDialPad
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              disabled={false}
              submitDisabled={!phoneNo}
              accentColor={accentColor}
            />
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={onClose}
              sx={{
                width: DIAL_PAD_MAX_WIDTH,
                height: DIAL_BUTTON_HEIGHT,
                fontSize: DIAL_ACTION_FONT_SIZE,
                ...kioskOutlinedSx(),
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Dialog>
  );
}
