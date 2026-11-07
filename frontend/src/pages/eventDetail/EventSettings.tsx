import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
} from "@mui/material";
import CropOriginalIcon from "@mui/icons-material/CropOriginal";
import DatasetLinkedIcon from "@mui/icons-material/DatasetLinked";
import DownloadIcon from "@mui/icons-material/Download";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import { ApiError, useApi } from "@/api";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import { useEventDetail } from "./useEventDetail";
import type { EventItem } from "../eventsList/useEvents";

export default function EventSettings() {
  const { eventId } = useParams({
    from: "/app-shell/admin/events/$eventId/settings",
  });

  const {
    event,
    isEventLoading,
    updateEvent,
    isUpdating,
    deleteEvent,
    isDeleting,
  } = useEventDetail(eventId);
  const navigate = useNavigate();
  const api = useApi();
  const { enqueueSnackbar } = useSnackbar();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const exportTicketsMutation = useMutation({
    mutationFn: () => api.post(`/api/events/${eventId}/ticketImages`),
    onSuccess: () =>
      enqueueSnackbar(
        "Export started but it'll take a while. Check the progress on the event page.",
        {
          variant: "success",
        },
      ),
    onError: (err: Error) =>
      enqueueSnackbar(
        err instanceof ApiError ? String(err.detail) : err.message,
        { variant: "error" },
      ),
  });

  if (isEventLoading || !event) {
    return <LinearProgress />;
  }

  const handleDelete = () => {
    deleteEvent(undefined, {
      onSuccess: () => navigate({ to: "/admin/events" }),
    });
  };

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Event settings"
        subtitle={event.name}
        onBack={() =>
          navigate({
            to: "/admin/events/$eventId",
            params: { eventId },
            search: {},
          })
        }
      />

      <SectionHeading icon={<InfoOutlinedIcon />}>
        Event information
      </SectionHeading>

      <EventDetailsForm
        key={event.id}
        event={event}
        saving={isUpdating}
        onSave={(payload) =>
          updateEvent(payload, {
            onSuccess: () =>
              enqueueSnackbar("Event details saved.", { variant: "success" }),
            onError: (err: Error) =>
              enqueueSnackbar(
                err instanceof ApiError ? String(err.detail) : err.message,
                { variant: "error" },
              ),
          })
        }
      />

      <Divider />

      <Stack direction="column">
        <SectionHeading icon={<TuneOutlinedIcon />}>
          Additional settings
        </SectionHeading>
        <List dense disablePadding={true} sx={{ pt: 1 }}>
          <ListItemButton
            disableGutters={true}
            onClick={() =>
              navigate({
                to: "/admin/events/$eventId/ticketDelivery",
                params: { eventId },
              })
            }
          >
            <ListItemIcon>
              <EmailOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Ticket delivery"
              secondary="Sender, subject, and the message sent with every ticket."
            />
          </ListItemButton>
          <ListItemButton
            disableGutters={true}
            onClick={() =>
              navigate({
                to: "/admin/events/$eventId/customizeKiosk",
                params: { eventId },
              })
            }
          >
            <ListItemIcon>
              <CropOriginalIcon />
            </ListItemIcon>
            <ListItemText
              primary="Kiosk customization"
              secondary={
                event.hasBoothImage
                  ? "Cover image, accent color, and guest message. A cover image is set."
                  : "Cover image, accent color, and guest message. No cover image is set."
              }
            />
          </ListItemButton>
          <ListItemButton
            disableGutters={true}
            onClick={() =>
              navigate({
                to: "/admin/events/$eventId/dataSources",
                params: { eventId },
              })
            }
          >
            <ListItemIcon>
              <DatasetLinkedIcon />
            </ListItemIcon>
            <ListItemText
              primary="Data sources"
              secondary="Spreadsheets that keep the guest list up to date."
            />
          </ListItemButton>
          <ListItemButton
            disableGutters={true}
            disabled={exportTicketsMutation.isPending}
            onClick={() => exportTicketsMutation.mutate()}
          >
            <ListItemIcon>
              <DownloadIcon />
            </ListItemIcon>
            <ListItemText
              primary="Export ticket images"
              secondary="Download ticket images for existing participants in a ZIP file."
            />
          </ListItemButton>
          <ListItemButton
            disableGutters={true}
            onClick={() => setDeleteOpen(true)}
          >
            <ListItemIcon>
              <DeleteIcon color="error" />
            </ListItemIcon>
            <ListItemText
              primary="Delete event"
              secondary="Removes the event, its people, and its check-in history."
              slotProps={{
                primary: { sx: { color: "error.main" } },
                secondary: { sx: { color: "error.main" } },
              }}
            />
          </ListItemButton>
        </List>
      </Stack>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete this event?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            &ldquo;{event.name}&rdquo; and everyone on its guest list will be
            removed for good. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
            Keep
          </Button>
          <Button onClick={handleDelete} color="error" loading={isDeleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function EventDetailsForm({
  event,
  saving,
  onSave,
}: {
  event: EventItem;
  saving: boolean;
  onSave: (payload: {
    name: string;
    description: string;
    date: string;
  }) => void;
}) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState<dayjs.Dayjs | null>(dayjs(event.date));
  const [submitted, setSubmitted] = useState(false);
  const nameError = submitted && !name.trim();
  const dateError = submitted && !date;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (!name.trim() || !date) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      date: date.format("YYYY-MM-DD"),
    });
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Event name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        error={nameError}
        helperText={nameError ? "Enter a name for the event." : undefined}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        multiline
        rows={3}
      />
      <DatePicker
        label="Date"
        value={date}
        onChange={setDate}
        format="YYYY-MM-DD"
        slotProps={{
          textField: {
            required: true,
            error: dateError,
            helperText: dateError ? "Pick a date." : undefined,
          },
        }}
      />
      <Button
        type="submit"
        variant="contained"
        startIcon={<SaveIcon />}
        loading={saving}
        sx={{ alignSelf: "flex-start" }}
      >
        Save
      </Button>
    </Stack>
  );
}
