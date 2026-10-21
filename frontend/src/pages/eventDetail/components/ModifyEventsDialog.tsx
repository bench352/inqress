import { type FormEvent, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
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
  TextField,
  Typography,
} from "@mui/material";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import CropOriginalIcon from "@mui/icons-material/CropOriginal";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useApi } from "@/api.ts";
import { useSnackbar } from "notistack";
import MessageTemplateDialog from "./MessageTemplateDialog";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";

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

type DialogView = "settings" | "edit" | "message" | "delete" | "export";

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
  const [editSubmitted, setEditSubmitted] = useState(false);
  const editNameError = editSubmitted && !editName.trim();
  const editDateError = editSubmitted && !editDate;

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
    setEditSubmitted(false);
    setView("edit");
  };

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditSubmitted(true);
    if (!editName.trim() || !editDate) return;
    onUpdate({
      name: editName.trim(),
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

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Modify Events</DialogTitle>
        <List>
          <ListItemButton onClick={openEdit}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText primary="Edit event details" />
          </ListItemButton>
          <ListItemButton onClick={() => setView("message")}>
            <ListItemIcon>
              <ArticleOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Edit message template" />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              handleClose();
              navigate({
                to: "/admin/events/$eventId/customizeKiosk",
                params: { eventId },
              });
            }}
          >
            <ListItemIcon>
              <CropOriginalIcon />
            </ListItemIcon>
            <ListItemText primary="Customize kiosk" />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              handleClose();
              navigate({
                to: "/admin/events/$eventId/dataSources",
                params: { eventId },
              });
            }}
          >
            <ListItemIcon>
              <SyncOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="Data sources" />
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

      <Dialog
        open={view === "edit"}
        onClose={() => setView("settings")}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Event Details</DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="edit-event-form"
            onSubmit={handleEditSubmit}
            noValidate
          >
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Event name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                fullWidth
                required
                error={editNameError}
                helperText={editNameError ? "Event name is required" : " "}
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
                slotProps={{
                  textField: {
                    required: true,
                    error: editDateError,
                    helperText: editDateError ? "Date is required" : " ",
                  },
                }}
                sx={{ width: "100%" }}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={() => setView("settings")}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-event-form"
            variant="contained"
            loading={isUpdating}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <MessageTemplateDialog
        open={view === "message"}
        eventId={eventId}
        onClose={() => setView("settings")}
      />

      <Dialog open={view === "delete"} onClose={() => setView("settings")}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{event.name}&rdquo;? This
            action cannot be undone. All participants and attendance records
            will be permanently removed.
          </DialogContentText>
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

      <Dialog open={view === "export"}>
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
          <Typography variant="h6">
            Exporting all guest information to ticket images...
          </Typography>
        </Box>
      </Dialog>
    </>
  );
}
