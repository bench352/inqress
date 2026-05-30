import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import BackspaceIcon from "@mui/icons-material/Backspace";
import { useQuery } from "@tanstack/react-query";
import PhoneDialPad, { DIAL_BUTTON_HEIGHT } from "./PhoneDialPad";
import CheckinResultDisplay from "./CheckinResultDisplay";
import { useApi } from "../../../api";
import type { CheckinResponse } from "../types";

interface Props {
  open: boolean;
  eventId: string;
  onClose: () => void;
}

interface CountryCodesResponse {
  default: string;
  options: string[];
}

type Phase = "input" | "loading" | "success" | "error";

const DIAL_PAD_MAX_WIDTH = 360;
const PHONE_ICON_SIZE = 120;
const PHONE_NO_FONT_SIZE = 22;

export default function CheckinByPhoneDialog({
  open,
  eventId,
  onClose,
}: Props) {
  const api = useApi();
  const [userSelectedCode, setUserSelectedCode] = useState<string | null>(null);
  const [phoneNo, setPhoneNo] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
        setResult(data);
        setPhase(data.success ? "success" : "error");
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setPhase("error");
      });
  };

  if (!open) return null;

  if (phase !== "input") {
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
            p: 6,
            bgcolor: "grey.100",
          }}
        >
          <PhoneAndroidIcon
            sx={{ fontSize: PHONE_ICON_SIZE, color: "primary.main" }}
          />
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              maxWidth: DIAL_PAD_MAX_WIDTH * 1.5,
              pt: 4,
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
                  endAdornment: phoneNo ? (
                    <IconButton
                      onClick={handleBackspace}
                      edge="end"
                      size="small"
                    >
                      <BackspaceIcon />
                    </IconButton>
                  ) : undefined,
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
            }}
          >
            Return to QR check-in
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
