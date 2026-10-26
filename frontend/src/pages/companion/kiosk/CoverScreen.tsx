import type { ReactNode } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";

export const DEFAULT_KIOSK_MESSAGE =
  "Please present your QR code to the receptionist.";

interface Props {
  eventName?: string;
  message?: string;
  accentColor: string | null;
  coverUrl: string | null;
  banner?: string | null;
  onPhone?: () => void;
  onEmail?: () => void;
  footer?: ReactNode;
}

/**
 * The kiosk's idle screen, shared with the admin preview so both stay in step.
 * Give it a box of the kiosk's size; it fills whatever it is placed in.
 */
export default function CoverScreen({
  eventName,
  message,
  accentColor,
  coverUrl,
  banner,
  onPhone,
  onEmail,
  footer,
}: Props) {
  const accentSx = accentColor
    ? { bgcolor: accentColor, "&:hover": { bgcolor: accentColor } }
    : undefined;

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        height: "100%",
        width: "100%",
        minWidth: 0,
      }}
    >
      {/* Left: cover, natural aspect, full height, capped at half the width */}
      {coverUrl && (
        <Box
          sx={{
            maxWidth: "50%",
            flex: "0 0 auto",
            alignSelf: "stretch",
            overflow: "hidden",
            bgcolor: "#111",
          }}
        >
          <Box
            component="img"
            src={coverUrl}
            alt=""
            sx={{ height: "100%", width: "auto", display: "block" }}
          />
        </Box>
      )}

      {/* Right */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          position: "relative",
          p: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 6,
        }}
      >
        {banner && (
          <Typography sx={{ fontWeight: 500, color: "success.main" }}>
            {banner}
          </Typography>
        )}
        <Stack spacing={1.5}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              color: accentColor,
              display: "-webkit-box",
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
            }}
          >
            {eventName}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {message?.trim() || DEFAULT_KIOSK_MESSAGE}
          </Typography>
        </Stack>

        <Stack spacing={2} sx={{ width: "100%", maxWidth: 420, mt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            Cannot scan QR code?
          </Typography>
          {onPhone && (
            <Button
              variant="contained"
              size="large"
              startIcon={<PhoneAndroidIcon fontSize="inherit" />}
              onClick={onPhone}
              sx={{ height: "70px", py: 1, fontSize: "1.5rem", ...accentSx }}
            >
              Check in with phone No.
            </Button>
          )}
          <Button
            variant="contained"
            size="large"
            startIcon={<EmailIcon fontSize="inherit" />}
            onClick={onEmail}
            tabIndex={onEmail ? undefined : -1}
            sx={{ height: "70px", py: 1, fontSize: "1.5rem", ...accentSx }}
          >
            Check in with email
          </Button>
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
              Tap an option on the screen to continue
            </Typography>
          </Stack>
        </Stack>

        {footer}
      </Box>
    </Box>
  );
}
