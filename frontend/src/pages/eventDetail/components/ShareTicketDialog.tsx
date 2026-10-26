import { useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ShareIcon from "@mui/icons-material/Share";
import DownloadIcon from "@mui/icons-material/Download";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import AppDialog from "@/components/AppDialog";
import ImagePreviewDialog from "@/components/ImagePreviewDialog";
import type { ParticipantItem } from "../useEventDetail";
import { useTicketImage } from "../useTicketImage";

// Name for the share sheet only, so the original characters survive. Control
// characters and bidi overrides go: the first can break a save, the second can
// make the name display as something it is not.
function ticketFileName(name: string): string {
  const cleaned = Array.from(name)
    .filter((ch) => !/[\p{Cc}\p{Bidi_Control}]/u.test(ch))
    .filter((ch) => !'\\/:*?"<>|'.includes(ch))
    .join("")
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const trimmed = Array.from(cleaned).slice(0, 200).join("").trim();
  return trimmed ? `QR TICKET - ${trimmed}.png` : "QR TICKET.png";
}

interface Props {
  open: boolean;
  eventId: string;
  participant: ParticipantItem;
  eventName: string;
  onClose: () => void;
}

export default function ShareTicketDialog({
  open,
  eventId,
  participant,
  eventName,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [previewOpen, setPreviewOpen] = useState(false);

  const ticket = useTicketImage(eventId, participant.id, open);

  const messageQuery = useQuery({
    queryKey: ["ticketMessage", eventId, participant.id],
    queryFn: () =>
      api.getText(
        `/api/events/${eventId}/participants/${participant.id}/message`,
      ),
    enabled: open,
  });

  const deliverMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/events/${eventId}/participants/${participant.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      enqueueSnackbar("Ticket marked as delivered.", { variant: "success" });
    },
  });

  const message = messageQuery.data ?? "";
  const fileName = ticketFileName(participant.name);
  const blob = ticket.blob;
  let canShare = false;
  if (blob) {
    try {
      canShare =
        typeof navigator.canShare === "function" &&
        navigator.canShare({
          files: [new File([blob], fileName, { type: "image/png" })],
          text: message,
        });
    } catch {
      canShare = false;
    }
  }

  const handleCopyImage = async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      enqueueSnackbar("Ticket image copied.", { variant: "success" });
    } catch {
      enqueueSnackbar("Could not copy the image. Download it instead.", {
        variant: "error",
      });
    }
  };

  const handleCopyText = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      enqueueSnackbar("Message copied.", { variant: "success" });
    } catch {
      enqueueSnackbar("Could not copy the message.", { variant: "error" });
    }
  };

  const handleDownload = () => {
    if (!ticket.url) return;
    const a = document.createElement("a");
    a.href = ticket.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (!blob) return;
    try {
      await navigator.share({
        files: [new File([blob], fileName, { type: "image/png" })],
        text: message,
        title: `Ticket - ${eventName}`,
      });
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        enqueueSnackbar(
          "Could not share. Copy the image and message instead.",
          {
            variant: "error",
          },
        );
      }
    }
  };

  const isLoading = ticket.isLoading || messageQuery.isLoading;
  const isError = ticket.isError || messageQuery.isError;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      title="Share ticket"
      contentSx={{
        display: "flex",
        flexDirection: "column",
        overflowY: "hidden",
      }}
      paperSx={{ height: "100%" }}
    >
      <Box sx={{ mt: 1, flex: 1, minHeight: 0, display: "flex" }}>
        {isLoading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              py: 4,
              m: "auto",
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {!isLoading && isError && (
          <Typography color="error" sx={{ m: "auto" }}>
            Could not load the ticket.
          </Typography>
        )}
        {!isLoading && !isError && (
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 2,
              flex: 1,
              minHeight: 0,
            }}
          >
            <Stack spacing={2} sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  flex: 1,
                  minHeight: { xs: 96, md: 0 },
                  overflow: "auto",
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {message}
                </Typography>
              </Paper>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1,
                }}
              >
                <Button
                  onClick={handleCopyText}
                  disabled={!message}
                  variant="outlined"
                  size="large"
                  startIcon={<ContentCopyIcon />}
                >
                  Copy message
                </Button>
                <Button
                  onClick={handleCopyImage}
                  disabled={!blob}
                  variant="outlined"
                  size="large"
                  startIcon={<ContentCopyIcon />}
                >
                  Copy image
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={!ticket.url}
                  variant="outlined"
                  size="large"
                  startIcon={<DownloadIcon />}
                >
                  Download
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={!canShare}
                  variant="contained"
                  size="large"
                  startIcon={<ShareIcon />}
                >
                  Share
                </Button>
                <Button
                  onClick={() => deliverMutation.mutate()}
                  disabled={
                    participant.isTicketDelivered || deliverMutation.isPending
                  }
                  variant="outlined"
                  size="large"
                  color="success"
                  startIcon={<HowToRegIcon />}
                  sx={{ gridColumn: { xs: "1 / -1" } }}
                >
                  {participant.isTicketDelivered
                    ? "Ticket delivered"
                    : "Mark delivered"}
                </Button>
              </Box>
              <ButtonBase
                onClick={() => setPreviewOpen(true)}
                sx={{
                  display: { xs: "flex", md: "none" },
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1,
                  textAlign: "left",
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    width: 64,
                    height: 64,
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {ticket.url && (
                    // The QR band is the top square of the 9:16 ticket.
                    <Box
                      component="img"
                      src={ticket.url}
                      alt=""
                      sx={{
                        display: "block",
                        width: 1,
                        aspectRatio: "1",
                        objectFit: "cover",
                        objectPosition: "top",
                      }}
                    />
                  )}
                </Paper>
                <Box>
                  <Typography variant="subtitle1">
                    Preview ticket image
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    received by participant.
                  </Typography>
                </Box>
              </ButtonBase>
            </Stack>
            <Paper
              elevation={8}
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flex: "0 1 auto",
                // Safety net: the image column sizes itself, but never past
                // half the dialog, so the message column stays usable.
                maxWidth: { md: "50%" },
              }}
            >
              {ticket.url && (
                <Box
                  component="img"
                  src={ticket.url}
                  alt="Ticket"
                  sx={{
                    width: { xs: "100%", md: "auto" },
                    height: { md: "100%" },
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              )}
            </Paper>
          </Box>
        )}
      </Box>

      <ImagePreviewDialog
        open={previewOpen}
        src={ticket.url}
        alt="Ticket"
        onClose={() => setPreviewOpen(false)}
      />
    </AppDialog>
  );
}
