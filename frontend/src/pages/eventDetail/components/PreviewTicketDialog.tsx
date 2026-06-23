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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "../../../api";

interface Props {
  open: boolean;
  eventId: string;
  participantId: string;
  onClose: () => void;
}

export default function PreviewTicketDialog({
  open,
  eventId,
  participantId,
  onClose,
}: Props) {
  const api = useApi();
  const { enqueueSnackbar } = useSnackbar();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const ticketQuery = useQuery({
    queryKey: ["ticketPreview", eventId, participantId],
    queryFn: () =>
      api.getBlob(
        `/api/events/${eventId}/participants/${participantId}/ticket/preview`,
      ),
    enabled: open,
  });

  const fullTicketMutation = useMutation({
    mutationFn: () =>
      api.getBlob(
        `/api/events/${eventId}/participants/${participantId}/ticketImage`,
      ),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${participantId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onError: () => {
      enqueueSnackbar("Failed to download full ticket image", {
        variant: "error",
      });
    },
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

  const handleDownloadQr = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `ticket-${participantId}.png`;
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
      <DialogTitle>Preview Ticket</DialogTitle>
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
          onClick={handleDownloadQr}
          variant="text"
          disabled={!imageUrl}
        >
          Download QR code
        </Button>
        <Button
          onClick={() => fullTicketMutation.mutate()}
          variant="contained"
          disabled={!participantId || fullTicketMutation.isPending}
          startIcon={
            fullTicketMutation.isPending ? (
              <CircularProgress size={16} />
            ) : undefined
          }
        >
          Download full ticket image
        </Button>
      </DialogActions>
    </Dialog>
  );
}
