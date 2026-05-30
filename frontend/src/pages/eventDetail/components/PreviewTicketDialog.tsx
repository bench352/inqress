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
import { useQuery } from "@tanstack/react-query";
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
  const blobUrlRef = useRef<string | null>(null);

  const ticketQuery = useQuery({
    queryKey: ["ticketPreview", eventId, attendeeId],
    queryFn: () =>
      api.getBlob(
        `/api/events/${eventId}/attendees/${attendeeId}/ticket/preview`,
      ),
    enabled: open,
  });

  useEffect(() => {
    if (ticketQuery.data) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const url = URL.createObjectURL(ticketQuery.data);
      blobUrlRef.current = url;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Blob URL management requires state sync with external resource
      setImageUrl(url);
    } else {
      setImageUrl(null);
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [ticketQuery.data]);

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
          {ticketQuery.isLoading && <CircularProgress />}
          {!ticketQuery.isLoading && imageUrl && (
            <Box
              component="img"
              src={imageUrl}
              alt="Ticket QR"
              sx={{ maxWidth: "100%" }}
            />
          )}
          {!ticketQuery.isLoading && !imageUrl && (
            <Box>Failed to load ticket image.</Box>
          )}
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
