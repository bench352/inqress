import { useState } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardHeader,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Fab,
  IconButton,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import DeviceUnknownIcon from "@mui/icons-material/DeviceUnknown";
import LaunchIcon from "@mui/icons-material/Launch";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CheckIcon from "@mui/icons-material/Check";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/providers/useAuth";
import CameraSettingsDialog from "./CameraSettingsDialog";

interface StoredCompanion {
  eventId: string;
  name: string;
  mode: "kiosk" | "scanner";
  token: string;
}

const STORAGE_KEY = "inqress.companions";

function modeLabel(mode: StoredCompanion["mode"]): string {
  if (mode === "kiosk") return "Kiosk";
  return "Scanner";
}

function deviceUrl(d: StoredCompanion): string {
  return `${window.location.origin}/companion/events/${d.eventId}/${d.mode}`;
}

export default function CompanionDevices() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [devices, setDevices] = useState<StoredCompanion[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const removeDevice = (eventId: string) => {
    const next = devices.filter((d) => d.eventId !== eventId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDevices(next);
  };

  const openDevice = (d: StoredCompanion) => {
    if (d.mode === "kiosk") {
      navigate({
        to: "/companion/events/$eventId/kiosk",
        params: { eventId: d.eventId },
      });
    } else {
      navigate({
        to: "/companion/events/$eventId/scanner",
        params: { eventId: d.eventId },
      });
    }
  };

  const goJoin = () => {
    navigate({ to: "/companion/join" });
  };

  const copyLink = async (d: StoredCompanion) => {
    try {
      await navigator.clipboard.writeText(deviceUrl(d));
      setCopiedEventId(d.eventId);
      setTimeout(() => setCopiedEventId(null), 1500);
    } catch {
      // clipboard unavailable (insecure context); ignore
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            InQRess - Companion devices
          </Typography>
          <Tooltip title="Switch camera">
            <IconButton
              color="inherit"
              aria-label="Switch camera"
              onClick={() => setCameraDialogOpen(true)}
            >
              <CameraswitchIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {isAuthenticated && alertOpen && (
        <Alert
          severity="warning"
          onClose={() => setAlertOpen(false)}
          sx={{ borderRadius: 0 }}
          action={
            <Button color="inherit" size="small" onClick={() => logout()}>
              Log out
            </Button>
          }
        >
          An administrator is still signed in on this browser. On a guest-facing
          device, log out so no one else can reach the admin pages.
        </Alert>
      )}

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {devices.length === 0 && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <DeviceUnknownIcon
              sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
            />
            <Typography color="text.secondary">
              Nothing is paired on this device yet. Try adding one using the (+)
              button.
            </Typography>
          </Box>
        )}

        {devices.map((d) => (
          <Card key={d.eventId} variant="outlined" sx={{ mb: 2 }}>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {d.mode === "scanner" ? (
                    <PhoneAndroidIcon />
                  ) : (
                    <DesktopWindowsIcon />
                  )}
                </Avatar>
              }
              title={d.name || d.eventId}
              slotProps={{
                title: { variant: "subtitle1", fontWeight: 600 },
                subheader: { component: "div" },
              }}
              subheader={
                <Chip
                  size="small"
                  variant="outlined"
                  label={modeLabel(d.mode)}
                  sx={{ mt: 0.5 }}
                />
              }
            />
            <CardActions
              disableSpacing
              sx={{ justifyContent: "space-between", px: 2, pb: 2 }}
            >
              <Button
                size="small"
                startIcon={
                  copiedEventId === d.eventId ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )
                }
                onClick={() => copyLink(d)}
              >
                Copy link
              </Button>
              <Box>
                <Tooltip title="Remove from this browser">
                  <IconButton
                    aria-label="remove this device"
                    onClick={() => setConfirmDelete(d.eventId)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  endIcon={<LaunchIcon />}
                  onClick={() => openDevice(d)}
                >
                  Open
                </Button>
              </Box>
            </CardActions>
          </Card>
        ))}
      </Container>

      <Fab
        color="primary"
        aria-label="pair a new device"
        onClick={goJoin}
        sx={{ position: "fixed", bottom: 24, right: 24 }}
      >
        <AddIcon />
      </Fab>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove this device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This unlinks the event from this browser only. You can pair it again
            with the pairing screen on the admin page.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (confirmDelete) removeDevice(confirmDelete);
              setConfirmDelete(null);
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <CameraSettingsDialog
        open={cameraDialogOpen}
        onClose={() => setCameraDialogOpen(false)}
      />
    </Box>
  );
}
