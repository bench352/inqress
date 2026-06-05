import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import BackspaceIcon from "@mui/icons-material/Backspace";

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled: boolean;
  submitDisabled: boolean;
  accentColor: string;
}

const digits = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export const DIAL_DIGIT_FONT_SIZE = "2rem";
export const DIAL_ACTION_FONT_SIZE = "1.3rem";
export const DIAL_BUTTON_HEIGHT = 68;

export default function PhoneDialPad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled,
  submitDisabled,
  accentColor,
}: Props) {
  return (
    <Grid container spacing={1} sx={{ maxWidth: 360 }}>
      {digits.map((row, ri) =>
        row.map((digit) => (
          <Grid key={ri * 3 + row.indexOf(digit)} size={4}>
            <Button
              fullWidth
              variant="contained"
              disabled={disabled}
              onClick={() => onDigit(digit)}
              sx={{
                height: DIAL_BUTTON_HEIGHT,
                fontSize: DIAL_DIGIT_FONT_SIZE,
                bgcolor: accentColor,
                "&:hover": { bgcolor: accentColor },
              }}
            >
              {digit}
            </Button>
          </Grid>
        )),
      )}
      <Grid size={4}>
        <Button
          fullWidth
          variant="outlined"
          disabled={disabled}
          onClick={onBackspace}
          sx={{
            height: DIAL_BUTTON_HEIGHT,
            fontSize: DIAL_ACTION_FONT_SIZE,
            borderColor: accentColor,
            color: accentColor,
          }}
        >
          <BackspaceIcon />
        </Button>
      </Grid>
      <Grid size={8}>
        <Button
          fullWidth
          variant="contained"
          color="success"
          disabled={submitDisabled}
          onClick={onSubmit}
          sx={{ height: DIAL_BUTTON_HEIGHT, fontSize: DIAL_ACTION_FONT_SIZE }}
        >
          <CheckIcon sx={{ mr: 1 }} />
          Check In
        </Button>
      </Grid>
    </Grid>
  );
}
