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
import EmailIcon from "@mui/icons-material/Email";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PhoneIcon from "@mui/icons-material/Phone";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useApi } from "../../../api";
import type { AttendeeItem } from "../useEventDetail";
import PreviewTicketDialog from "./PreviewTicketDialog";
import EmailTicketDialog from "./EmailTicketDialog";

type SubView = "main" | "preview" | "email" | "deliver" | "attend" | "delete";

interface Props {
  open: boolean;
  attendee: AttendeeItem;
  eventId: string;
  eventName: string;
  eventMode: string;
  onClose: () => void;
}

export default function AttendeeDetailsDialog({
  open,
  attendee,
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
        `/api/events/${eventId}/attendees/${attendee.id}/ticket/delivery`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const data = await api.post<{
        success: boolean;
        detail: { reason?: string } | Record<string, unknown>;
      }>(`/api/events/${eventId}/checkin/manual`, {
        attendeeId: attendee.id,
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
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
      onClose();
    },
  });

  const assistedMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/events/${eventId}/checkin/assisted`, {
        attendeeId: attendee.id,
      });
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err: Error & { status?: number; detail?: string }) => {
      const message =
        err.detail || err.message || "Failed to send confirmation to booth";
      enqueueSnackbar(message, { variant: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.del(`/api/events/${eventId}/attendees`, [attendee.id]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendees", eventId] });
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
        attendeeId={attendee.id}
        onClose={() => setSubView("main")}
      />
    );
  }

  if (subView === "email") {
    return (
      <EmailTicketDialog
        open
        eventId={eventId}
        attendeeId={attendee.id}
        attendeeEmail={attendee.email}
        eventName={eventName}
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
            Mark the ticket as delivered for {attendee.title} {attendee.name}?
            This will not send an email.
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
            Mark {attendee.title} {attendee.name} as attended? This will check
            in this attendee immediately.
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
        <DialogTitle>Delete Attendee</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {attendee.title} {attendee.name}?
            This action cannot be undone.
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
      <DialogTitle>Attendee Details</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="h6">
            {attendee.title} {attendee.name}
          </Typography>
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2">{attendee.email}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body2">
                {attendee.countryCode} {attendee.phone}
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
            <ListItemButton
              onClick={() => setSubView("preview")}
              disabled={!attendee.isTicketReady}
            >
              <ListItemIcon>
                <QrCodeIcon />
              </ListItemIcon>
              <ListItemText
                primary="Preview ticket"
                secondary={
                  !attendee.isTicketReady
                    ? "Ticket image is still generating"
                    : undefined
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setSubView("email")}
              disabled={!attendee.isTicketReady}
            >
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText
                primary="Email ticket"
                secondary={
                  !attendee.isTicketReady
                    ? "Ticket image is still generating"
                    : undefined
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={handleDeliver}
              disabled={
                !attendee.isTicketReady ||
                attendee.isTicketDelivered ||
                deliverMutation.isPending
              }
            >
              <ListItemIcon>
                <LocalOfferIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mark ticket delivered"
                secondary={
                  !attendee.isTicketReady
                    ? "Ticket image is still generating"
                    : attendee.isTicketDelivered
                      ? "Already marked as delivered"
                      : undefined
                }
              />
            </ListItemButton>
            <ListItemButton
              onClick={() => setSubView("attend")}
              disabled={
                attendee.checkedInAt != null || checkinMutation.isPending
              }
            >
              <ListItemIcon>
                <CheckCircleIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mark attended"
                secondary={
                  attendee.checkedInAt != null
                    ? "Already checked in"
                    : undefined
                }
              />
            </ListItemButton>
            <ListItemButton onClick={() => setSubView("delete")}>
              <ListItemIcon>
                <DeleteIcon color="error" />
              </ListItemIcon>
              <ListItemText
                primary="Delete attendee"
                slotProps={{ primary: { sx: { color: "error.main" } } }}
              />
            </ListItemButton>
          </List>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
