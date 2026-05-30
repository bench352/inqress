import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  attendeeId: string;
  onClose: () => void;
}

export default function PreviewTicketDialog({
  open,
  eventId,
  attendeeId,
  onClose,
}: Props) {
  const api = useApi();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBlob(`/api/events/${eventId}/attendees/${attendeeId}/ticket/preview`)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [eventId, attendeeId, api]);

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `ticket-${attendeeId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      key={`preview-ticket-${open}`}
    >
      <DialogTitle>Ticket Preview</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            minHeight: 200,
            alignItems: "center",
          }}
        >
          {loading && <CircularProgress />}
          {!loading && imageUrl && (
            <Box
              component="img"
              src={imageUrl}
              alt="Ticket QR"
              sx={{ maxWidth: "100%" }}
            />
          )}
          {!loading && !imageUrl && <Box>Failed to load ticket image.</Box>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          onClick={handleDownload}
          variant="contained"
          disabled={!imageUrl}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}
