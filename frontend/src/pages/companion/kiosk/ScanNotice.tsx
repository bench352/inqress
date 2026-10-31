import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Slide, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { KIOSK_EDGE, KIOSK_SHADOW } from "./kioskStyles";
import { type CheckinResponse, isErrorDetail, isSuccessDetail } from "./types";

const NOTICE_MS = 5000;
const INSET = 32;
const ICON_SIZE = 60;

interface Props {
  /** Keyed by the scan, so a replacement slides in again. */
  notice: { key: number; result: CheckinResponse };
  /** The low battery card is in front: freeze, do not close. */
  paused: boolean;
  onDismiss: () => void;
}

/**
 * A scan result for the guest standing at the kiosk, shown beside whatever
 * screen is up instead of over it. Not modal: taps outside it reach the dialog
 * underneath, and only the low battery card pauses it.
 */
export default function ScanNotice({ notice, paused, onDismiss }: Props) {
  const [open, setOpen] = useState(true);
  const timerRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);
  const leftRef = useRef(NOTICE_MS);

  useEffect(() => {
    if (!open) return;
    if (paused) {
      // Freeze, keeping what is left for the resume.
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        leftRef.current = Math.max(0, deadlineRef.current - Date.now());
      }
      return;
    }
    deadlineRef.current = Date.now() + leftRef.current;
    timerRef.current = window.setTimeout(() => setOpen(false), leftRef.current);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, paused]);

  const { result } = notice;
  const error = result.success
    ? null
    : isErrorDetail(result.detail)
      ? result.detail
      : null;

  return createPortal(
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        // Above the phone, email and confirm dialogs, below the battery card.
        zIndex: (theme) => theme.zIndex.modal + 1,
      }}
    >
      <Slide direction="right" in={open} appear onExited={onDismiss}>
        <Box
          onClick={() => setOpen(false)}
          sx={{
            pointerEvents: "auto",
            position: "absolute",
            top: INSET,
            left: INSET,
            width: 420,
            p: 2,
            bgcolor: "background.paper",
            border: `2px solid ${KIOSK_EDGE}`,
            boxShadow: KIOSK_SHADOW,
            borderRadius: 1,
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          {result.success && isSuccessDetail(result.detail) ? (
            <Stack
              direction="column"
              spacing={2}
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <CheckCircleIcon
                sx={{ fontSize: ICON_SIZE, color: "success.main" }}
              />
              <Stack
                direction="column"
                spacing={0.5}
                sx={{
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="kioskSubtitle">Welcome</Typography>
                <Typography variant="kioskNameSmall">
                  {result.detail.title ? `${result.detail.title} ` : ""}
                  {result.detail.name}
                </Typography>
              </Stack>
            </Stack>
          ) : (
            <Stack
              direction="column"
              spacing={2}
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ErrorIcon sx={{ fontSize: ICON_SIZE, color: "error.main" }} />
              <Stack
                direction="column"
                spacing={0.5}
                sx={{
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="kioskSubtitle">
                  {error?.reason ?? "Check-in failed"}
                </Typography>
                {error?.name && (
                  <Typography variant="kioskNameSmall">
                    {error.title ? `${error.title} ` : ""}
                    {error.name}
                  </Typography>
                )}
              </Stack>
            </Stack>
          )}
        </Box>
      </Slide>
    </Box>,
    document.body,
  );
}
