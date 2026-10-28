import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PhoneIcon from "@mui/icons-material/Phone";
import QrCodeIcon from "@mui/icons-material/QrCode";
import ShareIcon from "@mui/icons-material/Share";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import VerifiedIcon from "@mui/icons-material/Verified";
import dayjs from "dayjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "@/api.ts";
import AppDialog from "@/components/AppDialog";
import ImagePreviewDialog from "@/components/ImagePreviewDialog";
import { useFullScreenDialog } from "@/hooks/useFullScreenDialog";
import type { ParticipantItem } from "../useEventDetail";
import type { ParticipantStep } from "../types";
import { useTicketImage } from "../useTicketImage";
import EmailTicketDialog from "./EmailTicketDialog";
import EditParticipantDialog from "./EditParticipantDialog";
import ShareTicketDialog from "./ShareTicketDialog";

function ticketStatus(participant: ParticipantItem): string {
  if (!participant.isTicketReady) return "Preparing...";
  if (!participant.isTicketDelivered) return "Not delivered";
  return "Delivered";
}

type Confirm =
  | "deliver"
  | "attend"
  | "undo-attend"
  | "delete"
  | "deactivate"
  | "attach"
  | "detach";

interface Props {
  participant: ParticipantItem;
  eventId: string;
  eventName: string;
  eventMode: string;
  step: ParticipantStep | null;
  onStep: (step: ParticipantStep | null) => void;
  onClose: () => void;
}

export default function ParticipantDetailsDialog({
  participant,
  eventId,
  eventName,
  eventMode,
  step,
  onStep,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const fullScreen = useFullScreenDialog();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const ticket = useTicketImage(eventId, participant.id, previewOpen);

  const name = `${participant.title ? `${participant.title} ` : ""}${participant.name}`;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
  };

  const deliverMutation = useMutation({
    mutationFn: async () => {
      await api.post(
        `/api/events/${eventId}/participants/${participant.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      refresh();
      setConfirm(null);
    },
  });

  const unmarkDeliveredMutation = useMutation({
    mutationFn: async () => {
      await api.del(
        `/api/events/${eventId}/participants/${participant.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      refresh();
    },
    onError: () => {
      enqueueSnackbar("Could not mark the ticket as not delivered.", {
        variant: "error",
      });
    },
  });

  const undoCheckinMutation = useMutation({
    mutationFn: async () => {
      await api.del(
        `/api/events/${eventId}/participants/${participant.id}/attendance`,
      );
    },
    onSuccess: () => {
      refresh();
      setConfirm(null);
    },
    onError: () => {
      setConfirm(null);
      enqueueSnackbar("Could not undo the check-in.", { variant: "error" });
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
            : "Could not check in this participant.",
        );
      }
      return data;
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (err: Error) => {
      setConfirm(null);
      enqueueSnackbar(err.message, { variant: "error" });
    },
  });

  const assistedMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/events/${eventId}/checkin/assisted`, {
        participantId: participant.id,
      });
    },
    onSuccess: () => {
      enqueueSnackbar("Confirmation sent to the kiosk", {
        variant: "success",
      });
      onClose();
    },
    onError: (err: Error & { status?: number; detail?: unknown }) => {
      const message =
        (typeof err.detail === "string" ? err.detail : err.message) ||
        "Could not send the confirmation to the kiosk.";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.del(`/api/events/${eventId}/participants`, [participant.id]);
    },
    onSuccess: () => {
      refresh();
      onClose();
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
      refresh();
      setConfirm(null);
    },
  });

  const setDetachedMutation = useMutation({
    mutationFn: async (detached: boolean) => {
      await api.put(
        `/api/events/${eventId}/participants/${participant.id}/detached`,
        { detached },
      );
    },
    onSuccess: () => {
      refresh();
      setConfirm(null);
    },
    onError: (err: Error & { status?: number; detail?: unknown }) => {
      enqueueSnackbar(
        (typeof err.detail === "string" ? err.detail : err.message) ||
          "Could not change syncing for this participant.",
        { variant: "error" },
      );
      setConfirm(null);
    },
  });

  const confirmDialog = (
    open: boolean,
    title: string,
    body: React.ReactNode,
    action: React.ReactNode,
    busy: boolean,
  ) => (
    <Dialog open={open} onClose={() => setConfirm(null)} fullWidth={fullScreen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{body}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirm(null)} disabled={busy}>
          Cancel
        </Button>
        {action}
      </DialogActions>
    </Dialog>
  );

  const details: {
    icon: React.ReactNode;
    key: string;
    value: string;
    valueColor?: string;
  }[] = [
    {
      icon: <EmailIcon color="action" />,
      key: "Email",
      value: participant.email ?? "No email address",
    },
    {
      icon: <PhoneIcon color="action" />,
      key: "Phone number",
      value:
        participant.countryCode && participant.phone
          ? `${participant.countryCode} ${participant.phone}`
          : "No phone number",
    },
    {
      icon: <ConfirmationNumberIcon color="action" />,
      key: "Ticket status",
      value: ticketStatus(participant),
    },
    ...(participant.checkedInAt
      ? [
          {
            icon: <CheckCircleIcon color="success" />,
            key: "Checked in at",
            value: dayjs(participant.checkedInAt).format("MMM D, YYYY h:mm A"),
            valueColor: "success",
          },
        ]
      : []),
  ];

  return (
    <>
      <AppDialog
        open
        onClose={onClose}
        maxWidth="sm"
        title={
          <Typography variant="h6" component="h2" sx={{ minWidth: 0 }}>
            Participant details
          </Typography>
        }
        titleEnd={
          <IconButton
            aria-label={
              participant.isTicketReady
                ? "Preview ticket"
                : "Ticket image is not ready yet"
            }
            disabled={!participant.isTicketReady}
            onClick={() => setPreviewOpen(true)}
            size="small"
          >
            <QrCodeIcon fontSize="inherit" />
          </IconButton>
        }
      >
        <Stack spacing={2}>
          <Stack spacing={0}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography
                variant="h5"
                sx={{ fontWeight: 900, flex: 1, minWidth: 0 }}
              >
                {name}
              </Typography>
              {participant.activated === false && (
                <Chip label="Deactivated" color="error" size="small" />
              )}
              {participant.activated == null && (
                <Chip label="To be admitted" color="warning" size="small" />
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {details.map((row, i) => (
                <Stack
                  key={i}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  {row.icon}
                  <Typography
                    variant="body1"
                    color={
                      row.valueColor ??
                      (row.value.startsWith("No ")
                        ? "text.secondary"
                        : "inherit")
                    }
                  >
                    {row.value}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
          {participant.managedBy && (
            <Alert
              severity={participant.detached ? "warning" : "info"}
              role="status"
              icon={participant.detached ? <LinkOffIcon /> : <LinkIcon />}
              action={
                participant.detached != null ? (
                  <Button
                    color="inherit"
                    size="small"
                    loading={setDetachedMutation.isPending}
                    onClick={() =>
                      setConfirm(participant.detached ? "attach" : "detach")
                    }
                  >
                    {participant.detached ? "Re-attach" : "Detach"}
                  </Button>
                ) : undefined
              }
            >
              <AlertTitle>
                {participant.detached
                  ? `Not synced with ${participant.managedBy.name}`
                  : `Synced with ${participant.managedBy.name}`}
              </AlertTitle>
              {participant.detached
                ? "Your edits stay. Delete becomes available once the data source is removed."
                : participant.managedBy.overwritesDetails
                  ? "Details cannot be edited while this data source is active."
                  : "Details can be edited because this data source does not write them. Delete becomes available once it is removed."}
            </Alert>
          )}

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
              {participant.activated == null ? "Admit" : "Reactivate"}
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
              Confirm at kiosk
            </Button>
          )}

          <Divider />

          <List dense disablePadding>
            <ListItemButton
              onClick={() => onStep("edit")}
              disabled={
                participant.managedBy?.overwritesDetails === true &&
                participant.detached !== true
              }
              disableGutters
            >
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
              <ListItemText
                primary="Edit details"
                secondary="Title, name, email, or phone."
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => onStep("email")}
              disabled={!participant.isTicketReady || !participant.email}
              disableGutters
            >
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText
                primary="Email ticket"
                secondary={
                  !participant.isTicketReady
                    ? "The ticket is still being made."
                    : !participant.email
                      ? "No email address."
                      : "Send the ticket email."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => onStep("share")}
              disabled={!participant.isTicketReady}
              disableGutters
            >
              <ListItemIcon>
                <ShareIcon />
              </ListItemIcon>
              <ListItemText
                primary="Share ticket"
                secondary={
                  !participant.isTicketReady
                    ? "The ticket is still being made."
                    : "Copy, download, or share the ticket."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() =>
                participant.isTicketDelivered
                  ? unmarkDeliveredMutation.mutate()
                  : setConfirm("deliver")
              }
              disabled={
                !participant.isTicketReady ||
                (participant.isTicketDelivered
                  ? unmarkDeliveredMutation.isPending
                  : deliverMutation.isPending)
              }
              disableGutters
            >
              <ListItemIcon>
                <LocalOfferIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  participant.isTicketDelivered
                    ? "Mark not delivered"
                    : "Mark delivered"
                }
                secondary={
                  !participant.isTicketReady
                    ? "The ticket is still being made."
                    : participant.isTicketDelivered
                      ? "Undoes the delivered status."
                      : "For when you handed the ticket over yourself."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() =>
                setConfirm(participant.checkedInAt ? "undo-attend" : "attend")
              }
              disabled={
                participant.checkedInAt
                  ? undoCheckinMutation.isPending
                  : participant.activated !== true || checkinMutation.isPending
              }
              disableGutters
            >
              <ListItemIcon>
                {participant.checkedInAt ? (
                  <PersonRemoveIcon />
                ) : (
                  <CheckCircleIcon />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  participant.checkedInAt ? "Undo check-in" : "Mark attended"
                }
                secondary={
                  participant.checkedInAt
                    ? "Removes the check-in status of the participant."
                    : participant.activated === false
                      ? "This ticket is deactivated."
                      : participant.activated == null
                        ? "This participant is not admitted yet."
                        : "Check in without anything from the participant."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setConfirm("deactivate")}
              disabled={
                participant.activated === false ||
                setActivatedMutation.isPending
              }
              disableGutters
            >
              <ListItemIcon>
                <BlockIcon />
              </ListItemIcon>
              <ListItemText
                primary="Deactivate ticket"
                secondary={
                  participant.activated === false
                    ? "Already deactivated."
                    : "Stops this ticket from checking in."
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setConfirm("delete")}
              disabled={participant.managedBy != null}
              disableGutters
            >
              <ListItemIcon>
                <DeleteIcon
                  color={participant.managedBy != null ? "disabled" : "error"}
                />
              </ListItemIcon>
              <ListItemText
                primary="Delete"
                secondary={
                  participant.managedBy != null
                    ? `${participant.managedBy.name} would add this person back on the next sync.`
                    : "Removes the participant and their ticket for good."
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
      </AppDialog>

      {confirmDialog(
        confirm === "deliver",
        "Mark ticket delivered?",
        `This records that ${name} received the ticket. No email is sent.`,
        <Button
          onClick={() => deliverMutation.mutate()}
          loading={deliverMutation.isPending}
        >
          Mark delivered
        </Button>,
        deliverMutation.isPending,
      )}

      {confirmDialog(
        confirm === "attend",
        "Check in this participant?",
        `${name} will be checked in right now, as if the ticket had been scanned.`,
        <Button
          onClick={() => checkinMutation.mutate()}
          loading={checkinMutation.isPending}
        >
          Check in
        </Button>,
        checkinMutation.isPending,
      )}

      {confirmDialog(
        confirm === "undo-attend",
        "Undo check-in?",
        `${name} will be marked as not checked in.`,
        <Button
          onClick={() => undoCheckinMutation.mutate()}
          color="error"
          loading={undoCheckinMutation.isPending}
        >
          Undo check-in
        </Button>,
        undoCheckinMutation.isPending,
      )}

      {confirmDialog(
        confirm === "delete",
        "Delete this participant?",
        `${name} and their ticket will be removed for good. Adding the same person again creates a different ticket.`,
        <Button
          onClick={() => deleteMutation.mutate()}
          color="error"
          loading={deleteMutation.isPending}
        >
          Delete
        </Button>,
        deleteMutation.isPending,
      )}

      {confirmDialog(
        confirm === "deactivate",
        "Deactivate this ticket?",
        `${name} will not be able to check in. You can reactivate the ticket at any time.`,
        <Button
          onClick={() => setActivatedMutation.mutate(false)}
          color="error"
          loading={setActivatedMutation.isPending}
        >
          Deactivate
        </Button>,
        setActivatedMutation.isPending,
      )}

      {confirmDialog(
        confirm === "detach",
        `Stop syncing with ${participant.managedBy?.name}?`,
        `Edits to ${name} will no longer be overwritten. The participant stays linked, so Delete remains unavailable until the data source is removed.`,
        <Button
          onClick={() => setDetachedMutation.mutate(true)}
          loading={setDetachedMutation.isPending}
        >
          Detach
        </Button>,
        setDetachedMutation.isPending,
      )}

      {confirmDialog(
        confirm === "attach",
        `Sync with ${participant.managedBy?.name} again?`,
        `Your changes to ${name} will be replaced by the data source on its next sync, and editing here will be unavailable.`,
        <Button
          onClick={() => setDetachedMutation.mutate(false)}
          loading={setDetachedMutation.isPending}
        >
          Re-attach
        </Button>,
        setDetachedMutation.isPending,
      )}

      <ImagePreviewDialog
        open={previewOpen}
        src={ticket.url}
        alt={`Ticket for ${name}`}
        onClose={() => setPreviewOpen(false)}
      />

      {step === "edit" && (
        <EditParticipantDialog
          open
          participant={participant}
          eventId={eventId}
          onClose={() => onStep(null)}
        />
      )}

      {step === "email" && (
        <EmailTicketDialog
          open
          eventId={eventId}
          participantId={participant.id}
          participantEmail={participant.email ?? ""}
          eventName={eventName}
          onClose={() => onStep(null)}
        />
      )}

      {step === "share" && (
        <ShareTicketDialog
          open
          eventId={eventId}
          participant={participant}
          eventName={eventName}
          onClose={() => onStep(null)}
        />
      )}
    </>
  );
}
