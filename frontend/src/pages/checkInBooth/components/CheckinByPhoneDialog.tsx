import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { useQuery } from "@tanstack/react-query";
import PhoneDialPad, { DIAL_BUTTON_HEIGHT } from "./PhoneDialPad";
import CheckinResultDisplay from "./CheckinResultDisplay";
import MultipleParticipantsCheckInDialog from "./MultipleParticipantsCheckInDialog";
import { useApi } from "../../../api";
import type { CheckinResponse } from "../types";

interface Props {
  open: boolean;
  eventId: string;
  accentColor: string;
  onClose: () => void;
}

interface CountryCodesResponse {
  default: string;
  options: string[];
}

interface ParticipantConflict {
  id: string;
  title: string | null;
  name: string;
  email: string | null;
  countryCode: string | null;
  phone: string | null;
  checkedInAt: string | null;
}

type Phase = "input" | "loading" | "success" | "error" | "multiple";

const DIAL_PAD_MAX_WIDTH = 360;
const PHONE_ICON_SIZE = 120;
const PHONE_NO_FONT_SIZE = 22;

export default function CheckinByPhoneDialog({
  open,
  eventId,
  accentColor,
  onClose,
}: Props) {
  const api = useApi();
  const [userSelectedCode, setUserSelectedCode] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [conflictingParticipants, setConflictingParticipants] = useState<
    ParticipantConflict[]
  >([]);

  const countryCodesQuery = useQuery<CountryCodesResponse>({
    queryKey: ["countryCodes", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/phones/countryCodes`),
    enabled: open,
  });

  const countryCodes = countryCodesQuery.data?.options ?? [];
  const defaultCountryCode =
    countryCodesQuery.data?.default ?? countryCodes[0] ?? "";
  const selectedCountryCode = userSelectedCode ?? defaultCountryCode;

  const handleCountryCodeChange = (code: string) => {
    setUserSelectedCode(code);
  };

  const handleDigit = useCallback((digit: string) => {
    setPhoneNo((prev) => prev + digit);
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNo((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = () => {
    if (!phoneNo) return;
    setPhase("loading");
    api
      .post<CheckinResponse>(`/api/events/${eventId}/checkin/phone`, {
        countryCode: selectedCountryCode,
        phoneNo,
      })
      .then((data) => {
        if (
          !data.success &&
          typeof data.detail === "object" &&
          data.detail !== null &&
          "conflictingParticipants" in data.detail
        ) {
          const detail = data.detail as {
            conflictingParticipants: ParticipantConflict[];
          };
          setConflictingParticipants(detail.conflictingParticipants);
          setPhase("multiple");
          return;
        }
        setResult(data);
        setPhase(data.success ? "success" : "error");
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setPhase("error");
      });
  };

  if (!open) return null;

  if (phase !== "input" && phase !== "multiple") {
    return (
      <Dialog open fullScreen>
        <CheckinResultDisplay
          phase={phase}
          result={result}
          errorMessage={errorMessage}
          onDismiss={onClose}
        />
      </Dialog>
    );
  }

  if (phase === "multiple") {
    return (
      <MultipleParticipantsCheckInDialog
        open
        eventId={eventId}
        accentColor={accentColor}
        participants={conflictingParticipants}
        onClose={onClose}
      />
    );
  }

  return (
    <Dialog open fullScreen>
      <Box sx={{ display: "flex", height: "100%" }}>
        <Box
          sx={{
            aspectRatio: "1 / 1",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            p: 9,
            bgcolor: "grey.100",
          }}
        >
          <PhoneAndroidIcon
            sx={{ fontSize: PHONE_ICON_SIZE, color: accentColor }}
          />
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              pt: 4,
              fontSize: 46,
            }}
          >
            Enter the phone number you registered for this event
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
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
            spacing={2}
            sx={{ width: "100%", maxWidth: DIAL_PAD_MAX_WIDTH }}
          >
            <FormControl>
              <InputLabel>Code</InputLabel>
              <Select
                value={selectedCountryCode}
                label="Code"
                onChange={(e) => handleCountryCodeChange(e.target.value)}
                sx={{ fontSize: PHONE_NO_FONT_SIZE }}
              >
                {countryCodes.map((code) => (
                  <MenuItem
                    key={code}
                    value={code}
                    sx={{ fontSize: PHONE_NO_FONT_SIZE }}
                  >
                    {code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              value={phoneNo}
              slotProps={{
                input: {
                  readOnly: true,
                  sx: { fontSize: PHONE_NO_FONT_SIZE },
                },
              }}
              placeholder="Phone number"
              sx={{ flex: 1 }}
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
            startIcon={<QrCode2Icon />}
            onClick={onClose}
            sx={{
              maxWidth: DIAL_PAD_MAX_WIDTH,
              width: "100%",
              height: DIAL_BUTTON_HEIGHT,
              fontSize: "1.3rem",
              borderColor: accentColor,
              color: accentColor,
            }}
          >
            Return to QR check-in
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
