import { useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import VerifiedIcon from "@mui/icons-material/Verified";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PhoneIcon from "@mui/icons-material/Phone";
import QrCodeIcon from "@mui/icons-material/QrCode";
import ShareIcon from "@mui/icons-material/Share";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import type { ParticipantItem } from "../useEventDetail";
import EmailTicketDialog from "./EmailTicketDialog";
import EditParticipantDialog from "./EditParticipantDialog";
import PreviewTicketDialog from "./PreviewTicketDialog";
import ShareTicketDialog from "./ShareTicketDialog";

function getTicketStatus(participant: ParticipantItem): string {
  if (!participant.isTicketReady) return "Generating...";
  if (!participant.isTicketDelivered) return "Undelivered";
  return "Delivered";
}

type SubView =
  | "main"
  | "preview"
  | "email"
  | "share"
  | "deliver"
  | "attend"
  | "delete"
  | "deactivate"
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

  const closeAll = () => {
    setSubView("main");
    onClose();
  };

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
      closeAll();
    },
  });

  const assistedMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/events/${eventId}/checkin/assisted`, {
        participantId: participant.id,
      });
    },
    onSuccess: () => {
      closeAll();
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
      closeAll();
    },
  });

  const setActivatedMutation = useMutation({
    mutationFn: async (activated: boolean) => {
      await api.put(
        `/api/events/${eventId}/participants/${participant.id}/activated`,
        { activated },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
    },
  });

  const handleDeliverConfirm = () => {
    deliverMutation.mutate(undefined, {
      onSuccess: () => setSubView("main"),
    });
  };

  const handleAttendConfirm = () => {
    checkinMutation.mutate();
  };

  const handleDeleteConfirm = () => deleteMutation.mutate();

  const handleDeactivateConfirm = () => {
    setActivatedMutation.mutate(false, {
      onSuccess: () => setSubView("main"),
    });
  };

  return (
    <>
      <Dialog open={open} onClose={closeAll} maxWidth="sm" fullWidth>
        <DialogTitle>Participant Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack spacing={0.5}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="h6" sx={{ minWidth: 0 }}>
                  {participant.title ? `${participant.title} ` : ""}
                  {participant.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  {participant.managedBy && (
                    <Chip
                      label="Externally managed"
                      color="primary"
                      size="small"
                    />
                  )}
                  {participant.activated === false && (
                    <Chip label="Deactivated" color="error" size="small" />
                  )}
                  {participant.activated == null && (
                    <Chip label="To be admitted" color="warning" size="small" />
                  )}
                </Stack>
              </Stack>
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
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <ConfirmationNumberIcon fontSize="small" color="action" />
                <Typography variant="body1">
                  {getTicketStatus(participant)}
                </Typography>
              </Stack>
              {participant.checkedInAt && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <CheckCircleIcon fontSize="small" color="success" />
                  <Typography variant="body1" color="success">
                    {dayjs(participant.checkedInAt).format(
                      "MMM D, YYYY h:mm A",
                    )}
                  </Typography>
                </Stack>
              )}
            </Stack>

            {participant.activated !== true && (
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<VerifiedIcon />}
                onClick={() => setActivatedMutation.mutate(true)}
                loading={setActivatedMutation.isPending}
                fullWidth
              >
                {participant.activated == null
                  ? "Admit participant"
                  : "Reactivate participant"}
              </Button>
            )}

            {eventMode !== "disabled" && participant.activated === true && (
              <Button
                variant="contained"
                size="large"
                startIcon={<HowToRegIcon />}
                onClick={() => assistedMutation.mutate()}
                loading={assistedMutation.isPending}
                disabled={!!participant.checkedInAt}
                fullWidth
              >
                Confirm at Booth
              </Button>
            )}

            <List disablePadding>
              <ListItemButton
                onClick={() => setSubView("edit")}
                disabled={participant.managedBy?.writesDetails === true}
              >
                <ListItemIcon>
                  <EditIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Update personal information"
                  secondary={
                    participant.managedBy?.writesDetails
                      ? `Details follow ${participant.managedBy.name}. Change them in that source.`
                      : "Change title, name, email, or phone."
                  }
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
                        : "Send / resend email with the QR code."
                  }
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setSubView("share")}
                disabled={!participant.isTicketReady}
              >
                <ListItemIcon>
                  <ShareIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Share ticket"
                  secondary={
                    !participant.isTicketReady
                      ? "Ticket image is still generating."
                      : "Share or copy the ticket image and its message."
                  }
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setSubView("deliver")}
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
                  participant.checkedInAt != null ||
                  participant.activated !== true ||
                  checkinMutation.isPending
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
                      : participant.activated === false
                        ? "Ticket is deactivated."
                        : participant.activated == null
                          ? "Participant is not yet admitted."
                          : "Mark as checked in without any action from the participant."
                  }
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setSubView("deactivate")}
                disabled={
                  participant.activated === false ||
                  setActivatedMutation.isPending
                }
              >
                <ListItemIcon>
                  <BlockIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Deactivate participant"
                  secondary={
                    participant.activated === false
                      ? "Already deactivated."
                      : "Deny this participant from checking in."
                  }
                />
              </ListItemButton>
              <ListItemButton
                onClick={() => setSubView("delete")}
                disabled={participant.managedBy != null}
              >
                <ListItemIcon>
                  <DeleteIcon
                    color={participant.managedBy != null ? "disabled" : "error"}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Delete participant"
                  secondary={
                    participant.managedBy != null
                      ? `${participant.managedBy.name} will add this person back on the next sync.`
                      : "Remove participant's registration from this event."
                  }
                  slotProps={
                    participant.managedBy != null
                      ? undefined
                      : {
                          primary: { sx: { color: "error.main" } },
                          secondary: { sx: { color: "error.main" } },
                        }
                  }
                />
              </ListItemButton>
            </List>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={subView === "deliver"} onClose={() => setSubView("main")}>
        <DialogTitle>Mark Ticket Delivered</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Mark the ticket as delivered for{" "}
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}? This will not send an email.
          </DialogContentText>
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

      <Dialog open={subView === "attend"} onClose={() => setSubView("main")}>
        <DialogTitle>Mark Attended</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Mark {participant.title ? `${participant.title} ` : ""}
            {participant.name} as attended? This will check in this participant
            immediately.
          </DialogContentText>
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

      <Dialog open={subView === "delete"} onClose={() => setSubView("main")}>
        <DialogTitle>Delete Participant</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete{" "}
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}? This is irreversible and the participant's
            ticket will be deactivated. If you want to add the participant
            again, a different QR ticket will be generated instead.
          </DialogContentText>
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

      <Dialog
        open={subView === "deactivate"}
        onClose={() => setSubView("main")}
      >
        <DialogTitle>Deactivate Participant</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate{" "}
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}? They will no longer be able to check in. You can
            reactivate this participant anytime.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setSubView("main")}
            disabled={setActivatedMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivateConfirm}
            color="error"
            loading={setActivatedMutation.isPending}
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      <PreviewTicketDialog
        open={subView === "preview"}
        eventId={eventId}
        participantId={participant.id}
        onClose={() => setSubView("main")}
      />

      <EmailTicketDialog
        open={subView === "email"}
        eventId={eventId}
        participantId={participant.id}
        participantEmail={participant.email ?? ""}
        eventName={eventName}
        onClose={() => setSubView("main")}
      />

      <ShareTicketDialog
        open={subView === "share"}
        eventId={eventId}
        participant={participant}
        eventName={eventName}
        onClose={() => setSubView("main")}
      />

      {subView === "edit" && (
        <EditParticipantDialog
          open
          participant={participant}
          eventId={eventId}
          onClose={() => setSubView("main")}
        />
      )}
    </>
  );
}
