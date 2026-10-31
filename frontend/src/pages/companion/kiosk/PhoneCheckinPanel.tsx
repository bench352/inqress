import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CloseIcon from "@mui/icons-material/Close";
import PhoneDialPad, {
  DIAL_ACTION_FONT_SIZE,
  DIAL_BUTTON_HEIGHT,
  DIAL_PAD_MAX_WIDTH,
} from "./PhoneDialPad";
import {
  accentOnSurface,
  KIOSK_MARKS_SURFACE,
  kioskInputSx,
} from "./kioskStyles";

interface PhoneCheckinPanelProps {
  accentColor: string;
  countryCodes: string[];
  selectedCountryCode: string;
  phoneNo: string;
  onCountryCodeChange?: (code: string) => void;
  onDigit?: (digit: string) => void;
  onBackspace?: () => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  submitDisabled?: boolean;
}

const PHONE_ICON_SIZE = 96;
const PHONE_NO_FONT_SIZE = 22;
const FIELD_MAX_WIDTH = DIAL_PAD_MAX_WIDTH;

/**
 * The phone check-in layout: icon column plus country select, number field,
 * dial pad and cancel. Shared by KioskPhoneDialog and the admin preview; with
 * no handlers it renders inert.
 */
export default function PhoneCheckinPanel({
  accentColor,
  countryCodes,
  selectedCountryCode,
  phoneNo,
  onCountryCodeChange,
  onDigit,
  onBackspace,
  onSubmit,
  onCancel,
  disabled = false,
  submitDisabled = false,
}: PhoneCheckinPanelProps) {
  return (
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
          sx={{
            fontSize: PHONE_ICON_SIZE,
            color: accentOnSurface(accentColor, KIOSK_MARKS_SURFACE),
          }}
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
              ...kioskInputSx(),
            }}
          >
            <Select
              value={selectedCountryCode}
              variant="standard"
              onChange={(e) => onCountryCodeChange?.(e.target.value)}
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
            sx={kioskInputSx()}
            slotProps={{
              input: {
                readOnly: true,
                sx: { fontSize: PHONE_NO_FONT_SIZE },
              },
            }}
          />
        </Stack>
        <PhoneDialPad
          onDigit={onDigit}
          onBackspace={onBackspace}
          onSubmit={onSubmit}
          disabled={disabled}
          submitDisabled={submitDisabled}
          accentColor={accentColor}
        />
        <Button
          variant="outlined"
          startIcon={<CloseIcon />}
          onClick={onCancel}
          sx={{
            width: DIAL_PAD_MAX_WIDTH,
            height: DIAL_BUTTON_HEIGHT,
            fontSize: DIAL_ACTION_FONT_SIZE,
          }}
        >
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
