import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ShareIcon from "@mui/icons-material/Share";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import type { ParticipantItem } from "../useEventDetail";

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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));
  const { enqueueSnackbar } = useSnackbar();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  const imageQuery = useQuery({
    queryKey: ["shareTicketImage", eventId, participant.id],
    queryFn: () =>
      api.getBlob(
        `/api/events/${eventId}/participants/${participant.id}/ticketImage`,
      ),
    enabled: open,
  });

  const messageQuery = useQuery({
    queryKey: ["ticketMessage", eventId, participant.id],
    queryFn: () =>
      api.getText(
        `/api/events/${eventId}/participants/${participant.id}/message`,
      ),
    enabled: open,
  });

  useEffect(() => {
    if (imageQuery.data) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const url = URL.createObjectURL(imageQuery.data);
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
  }, [imageQuery.data]);

  const deliverMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/events/${eventId}/participants/${participant.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      enqueueSnackbar("Ticket marked as delivered", { variant: "success" });
    },
  });

  const message = messageQuery.data ?? "";
  const fileName = ticketFileName(participant.name);
  const blob = imageQuery.data ?? null;
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
      enqueueSnackbar("Ticket image copied", { variant: "success" });
    } catch {
      enqueueSnackbar(
        "Could not copy the image. Save the ticket image itself.",
        {
          variant: "error",
        },
      );
    }
  };

  const handleCopyText = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      enqueueSnackbar("Message copied", { variant: "success" });
    } catch {
      enqueueSnackbar("Could not copy the message", { variant: "error" });
    }
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
          "Sharing failed. Copy the image and the message instead.",
          {
            variant: "error",
          },
        );
      }
    }
  };

  const isLoading = imageQuery.isLoading || messageQuery.isLoading;
  const isError = imageQuery.isError || messageQuery.isError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={!isDesktop}
      slotProps={{ paper: { sx: { height: "100%" } } }}
    >
      <DialogTitle>Share Ticket</DialogTitle>
      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden",
        }}
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
              Failed to load the ticket.
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
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
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
                    Copy ticket image
                  </Button>
                  <Button
                    onClick={handleShare}
                    disabled={!canShare}
                    variant="contained"
                    size="large"
                    fullWidth
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
                  >
                    {participant.isTicketDelivered
                      ? "Delivered"
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
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Paper
                    elevation={3}
                    sx={{
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {imageUrl && (
                      // The QR band is the top square of the 9:16 ticket.
                      <Box
                        component="img"
                        src={imageUrl}
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
                    <Typography variant="subtitle1">Ticket preview</Typography>
                    <Typography variant="body1" color="text.secondary">
                      Tap to view the full ticket
                    </Typography>
                  </Box>
                </ButtonBase>
              </Stack>
              <Paper
                elevation={3}
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
                {imageUrl && (
                  <Box
                    component="img"
                    src={imageUrl}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      {/* The preview is a picture: no chrome, the paper hugs the ticket. */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth={false}
        slotProps={{
          paper: {
            onClick: () => setPreviewOpen(false),
            sx: {
              width: "auto",
              maxWidth: "calc(100% - 64px)",
              maxHeight: "calc(100% - 64px)",
              overflow: "hidden",
            },
          },
        }}
      >
        {imageUrl && (
          <Box
            component="img"
            src={imageUrl}
            alt="Ticket"
            sx={{
              display: "block",
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "calc(100dvh - 64px)",
              objectFit: "contain",
            }}
          />
        )}
      </Dialog>
    </Dialog>
  );
}
