import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CropOriginalIcon from "@mui/icons-material/CropOriginal";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import EmailIcon from "@mui/icons-material/Email";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useApi } from "@/api.ts";
import { useSnackbar } from "notistack";
import EmailTemplateDialog from "./EmailTemplateDialog";

interface EventData {
  name: string;
  description: string;
  date: string;
  hasBoothImage: boolean;
}

interface Props {
  open: boolean;
  event: EventData;
  eventId: string;
  isUpdating: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onUpdate: (data: EventData) => void;
  onDelete: () => void;
}

type DialogView = "settings" | "edit" | "email" | "delete" | "export";

export default function ModifyEventsDialog({
  open,
  event,
  eventId,
  isUpdating,
  isDeleting,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [view, setView] = useState<DialogView>("settings");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState<dayjs.Dayjs | null>(null);

  const navigate = useNavigate();
  const api = useApi();
  const { enqueueSnackbar } = useSnackbar();

  const handleExportTickets = async () => {
    setView("export");
    try {
      const blob = await api.getBlob(`/api/events/${eventId}/ticketImages`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tickets.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      enqueueSnackbar("Failed to export tickets", { variant: "error" });
    }
    setView("settings");
  };

  const openEdit = () => {
    setEditName(event.name);
    setEditDescription(event.description);
    setEditDate(dayjs(event.date));
    setView("edit");
  };

  const handleEditSave = () => {
    if (!editDate) return;
    onUpdate({
      name: editName,
      description: editDescription,
      date: editDate.format("YYYY-MM-DD"),
      hasBoothImage: event.hasBoothImage,
    });
    setView("settings");
  };

  const handleClose = () => {
    setView("settings");
    onClose();
  };

  if (view === "edit") {
    return (
      <Dialog open onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Event Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Event name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
            <DatePicker
              label="Date"
              value={editDate}
              onChange={setEditDate}
              format="YYYY-MM-DD"
              sx={{ width: "100%" }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView("settings")} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            loading={isUpdating}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (view === "email") {
    return (
      <EmailTemplateDialog
        open
        eventId={eventId}
        onClose={() => setView("settings")}
      />
    );
  }

  if (view === "delete") {
    return (
      <Dialog open onClose={handleClose}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &ldquo;{event.name}&rdquo;? This
            action cannot be undone. All participants and attendance records
            will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setView("settings")} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            variant="contained"
            color="error"
            loading={isDeleting}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (view === "export") {
    return (
      <Dialog open>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              p: 3,
            }}
          >
            <CircularProgress />
            <Typography variant="body1" sx={{fontSize: 20}}>
              Exporting all guest information to ticket images...
            </Typography>
          </Box>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Modify Events</DialogTitle>
      <List>
        <ListItemButton onClick={openEdit}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <ListItemText primary="Edit event details" />
        </ListItemButton>
        <ListItemButton onClick={() => setView("email")}>
          <ListItemIcon>
            <EmailIcon />
          </ListItemIcon>
          <ListItemText primary="Edit email template" />
        </ListItemButton>
        <ListItemButton
          onClick={() => {
            handleClose();
            navigate({
              to: "/events/$eventId/customizeBooth",
              params: { eventId },
            });
          }}
        >
          <ListItemIcon>
            <CropOriginalIcon />
          </ListItemIcon>
          <ListItemText primary="Customize check-in booth" />
        </ListItemButton>
        <ListItemButton onClick={handleExportTickets}>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText primary="Export all tickets to image" />
        </ListItemButton>
        <ListItemButton onClick={() => setView("delete")}>
          <ListItemIcon>
            <DeleteIcon color="error" />
          </ListItemIcon>
          <ListItemText
            primary="Delete event"
            slotProps={{ primary: { sx: { color: "error.main" } } }}
          />
        </ListItemButton>
      </List>
    </Dialog>
  );
}
