import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import AppDialog from "@/components/AppDialog";
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
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title="Link companion"
      actions={
        <Button onClick={onRotate} color="error">
          Rotate pairing token
        </Button>
      }
    >
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Typography>
          On the kiosk or phone, open a browser and go to:
        </Typography>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, wordBreak: "break-all" }}
        >
          {window.location.origin}
        </Typography>
        <Typography>
          Open <strong>use as companion device</strong>. If this browser is
          already paired, unpair it first. Tap <strong>Pair this device</strong>
          , then scan the QR code below. After successful pairing, choose a mode
          matching how your companion device will be used.
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
      <Typography sx={{ mb: 2 }}>
        Copy these values, then paste them on the companion device&apos;s
        pairing screen.
      </Typography>
      <Stack spacing={2}>
        <CopyableField label="Event ID" value={eventId} />
        {companionToken && (
          <CopyableField label="Pairing token" value={companionToken} />
        )}
      </Stack>
    </AppDialog>
  );
}
