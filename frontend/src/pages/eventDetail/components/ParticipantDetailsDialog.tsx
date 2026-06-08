import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PhoneIcon from "@mui/icons-material/Phone";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import type { ParticipantItem } from "../useEventDetail";
import PreviewTicketDialog from "./PreviewTicketDialog";
import EmailTicketDialog from "./EmailTicketDialog";
import EditParticipantDialog from "./EditParticipantDialog";

type SubView =
  | "main"
  | "preview"
  | "email"
  | "deliver"
  | "attend"
  | "delete"
  | "edit";

interface Props {
  open: boolean;
  participant: ParticipantItem;
  eventId: string;
  eventName: string;
  eventMode: string;
  onClose: () => void;
}

export default function ParticipantDetailsDialog({
  open,
  participant,
  eventId,
  eventName,
  eventMode,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [subView, setSubView] = useState<SubView>("main");

  const deliverMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/events/${eventId}/participants/${participant.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const data = await api.post<{
        success: boolean;
        detail: { reason?: string } | Record<string, unknown>;
      }>(`/api/events/${eventId}/checkin/manual`, {
        participantId: participant.id,
      });
      if (!data.success) {
        throw new Error(
          "reason" in data.detail && typeof data.detail.reason === "string"
            ? data.detail.reason
            : "Check-in failed",
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      onClose();
    },
  });

  const assistedMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/events/${eventId}/checkin/assisted`, {
        participantId: participant.id,
      });
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err: Error & { status?: number; detail?: unknown }) => {
      const message =
        (typeof err.detail === "string" ? err.detail : err.message) ||
        "Failed to send confirmation to booth";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.del(`/api/events/${eventId}/participants`, [participant.id]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      onClose();
    },
  });

  const handleDeliver = () => setSubView("deliver");

  const handleDeliverConfirm = () => {
    deliverMutation.mutate(undefined, {
      onSuccess: () => setSubView("main"),
    });
  };

  const handleAttendConfirm = () => {
    checkinMutation.mutate();
  };

  const handleDeleteConfirm = () => deleteMutation.mutate();

  const handleClose = () => {
    setSubView("main");
    onClose();
  };

  if (subView === "preview") {
    return (
      <PreviewTicketDialog
        open
        eventId={eventId}
        participantId={participant.id}
        onClose={() => setSubView("main")}
      />
    );
  }

  if (subView === "email") {
    return (
      <EmailTicketDialog
        open
        eventId={eventId}
        participantId={participant.id}
        participantEmail={participant.email ?? ""}
        eventName={eventName}
        onClose={() => setSubView("main")}
      />
    );
  }

  if (subView === "edit") {
    return (
      <EditParticipantDialog
        open
        participant={participant}
        eventId={eventId}
        onClose={() => setSubView("main")}
      />
    );
  }

  if (subView === "deliver") {
    return (
      <Dialog open onClose={() => setSubView("main")}>
        <DialogTitle>Mark Ticket Delivered</DialogTitle>
        <DialogContent>
          <Typography>
            Mark the ticket as delivered for{" "}
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}? This will not send an email.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubView("main")}
            disabled={deliverMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeliverConfirm}
            variant="contained"
            loading={deliverMutation.isPending}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (subView === "attend") {
    return (
      <Dialog open onClose={() => setSubView("main")}>
        <DialogTitle>Mark Attended</DialogTitle>
        <DialogContent>
          <Typography>
            Mark {participant.title ? `${participant.title} ` : ""}
            {participant.name} as attended? This will check in this participant
            immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubView("main")}
            disabled={checkinMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAttendConfirm}
            variant="contained"
            loading={checkinMutation.isPending}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (subView === "delete") {
    return (
      <Dialog open onClose={() => setSubView("main")}>
        <DialogTitle>Delete Participant</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}? This is irreversible and the participant's
            ticket will be deactivated. If you want to add the participant
            again, a different QR ticket will be generated instead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubView("main")}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Participant Details</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="h6">
              {participant.title ? `${participant.title} ` : ""}
              {participant.name}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.email ?? "(No email address)"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.countryCode && participant.phone
                  ? `${participant.countryCode} ${participant.phone}`
                  : "(No phone number)"}
              </Typography>
            </Stack>
          </Stack>

          {eventMode !== "disabled" && (
            <Button
              variant="contained"
              startIcon={<HowToRegIcon />}
              onClick={() => assistedMutation.mutate()}
              loading={assistedMutation.isPending}
              fullWidth
            >
              Confirm at Booth
            </Button>
          )}

          <List disablePadding>
            <ListItemButton onClick={() => setSubView("edit")}>
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
              <ListItemText
                primary="Update personal information"
                secondary="Change title, name, email, or phone."
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setSubView("preview")}
              disabled={!participant.isTicketReady}
            >
              <ListItemIcon>
                <QrCodeIcon />
              </ListItemIcon>
              <ListItemText
                primary="Preview ticket"
                secondary={
                  !participant.isTicketReady
                    ? "Ticket image is still generating."
                    : "View QR code image or download it."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setSubView("email")}
              disabled={!participant.isTicketReady || !participant.email}
            >
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText
                primary="Email ticket"
                secondary={
                  !participant.isTicketReady
                    ? "Ticket image is still generating."
                    : !participant.email
                      ? "No email address."
                      : "Send an email with the QR code."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={handleDeliver}
              disabled={
                !participant.isTicketReady ||
                participant.isTicketDelivered ||
                deliverMutation.isPending
              }
            >
              <ListItemIcon>
                <LocalOfferIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mark ticket delivered"
                secondary={
                  !participant.isTicketReady
                    ? "Ticket image is still generating."
                    : participant.isTicketDelivered
                      ? "Already marked as delivered."
                      : "Manually mark ticket as received."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setSubView("attend")}
              disabled={
                participant.checkedInAt != null || checkinMutation.isPending
              }
            >
              <ListItemIcon>
                <CheckCircleIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mark attended"
                secondary={
                  participant.checkedInAt != null
                    ? "Already checked in."
                    : "Mark as checked in without any action from the participant."
                }
              />
            </ListItemButton>
            <ListItemButton onClick={() => setSubView("delete")}>
              <ListItemIcon>
                <DeleteIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Delete participant"
                secondary="Remove participant from this event. This will deactivate their ticket."
                slotProps={{
                  primary: { sx: { color: "error.main" } },
                  secondary: { sx: { color: "error.main" } },
                }}
              />
            </ListItemButton>
          </List>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
