import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import CopyableField from "./CopyableField";

interface Props {
  open: boolean;
  eventId: string;
  companionToken: string | null;
  onRotate: () => void;
  onClose: () => void;
}

export default function PairCompanionDialog({
  open,
  eventId,
  companionToken,
  onRotate,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Pair companion device</DialogTitle>
      <DialogContent>
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Typography>
            On the kiosk or phone, open a browser and go to
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, wordBreak: "break-all" }}
          >
            {window.location.origin}
          </Typography>
          <Typography>
            Open <strong>Companion devices</strong>, tap
            <strong> Pair a new device</strong>, then scan the QR code below
            with the camera. You&apos;ll choose whether the device is a kiosk or
            a scanner.
          </Typography>
        </Stack>
        {companionToken && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
            <QRCodeSVG
              value={`${window.location.origin}/companion/join#v1.${eventId}.${companionToken}`}
              size={220}
            />
          </Box>
        )}
        <Divider sx={{ my: 2 }}>Can&apos;t scan the QR code?</Divider>
        <Stack spacing={1.5}>
          <CopyableField label="Event ID" value={eventId} />
          {companionToken && (
            <CopyableField label="Pairing token" value={companionToken} />
          )}
        </Stack>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Or enter these values on the device's pairing screen. Rotate the
          pairing token to revoke all paired devices.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onRotate} color="error">
          Rotate pairing token
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
