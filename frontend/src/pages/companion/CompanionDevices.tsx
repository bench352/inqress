import { useEffect, useState } from "react";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import DeviceUnknownIcon from "@mui/icons-material/DeviceUnknown";
import LaunchIcon from "@mui/icons-material/Launch";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import CheckIcon from "@mui/icons-material/Check";
import { useNavigate } from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { useAuth } from "@/providers/useAuth";
import { useCompanionApi } from "@/api";
import EmptyState from "@/components/EmptyState";
import CameraSettingsDialog from "./CameraSettingsDialog";
import { clearPairing, readPairing, type StoredPairing } from "./pairing";

interface CompanionSession {
  eventId: string;
  name: string;
}

function modeLabel(mode: StoredPairing["mode"]): string {
  if (mode === "kiosk") return "Kiosk";
  return "Scanner";
}

export default function CompanionDevices() {
  const { isAuthenticated, logout } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const companionApi = useCompanionApi();
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(true);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [copied, setCopied] = useState(false);
  // Paired = live companion session AND local pairing for the same event.
  const [session, setSession] = useState<CompanionSession | null>(null);
  const [pairing, setPairing] = useState<StoredPairing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = readPairing();
      let sess: CompanionSession | null;
      try {
        sess = await companionApi.get<CompanionSession>(
          "/api/companion/session",
        );
      } catch {
        sess = null; // 401 or unreachable — no live pairing
      }
      if (sess && stored && stored.eventId === sess.eventId) {
        setSession(sess);
        setPairing(stored);
      } else {
        // Any mismatch (session without storage, storage without session,
        // or two different events) means unpaired; drop the stale storage and
        // the live cookie, so no credential is left the UI cannot manage.
        try {
          await companionApi.del("/api/companion/session");
        } catch {
          // Already gone — nothing to clear.
        }
        clearPairing();
        setSession(null);
        setPairing(null);
      }
      setLoaded(true);
    })();
  }, [companionApi]);

  const handleLogout = async () => {
    const signedOut = await logout();
    if (!signedOut) {
      enqueueSnackbar("Cannot sign out. Please try again.", {
        variant: "error",
      });
    }
  };

  const handleUnpair = async () => {
    setConfirmUnpair(false);
    try {
      await companionApi.del("/api/companion/session");
    } catch {
      // Idempotent — any outcome (401, network) leaves this browser unpaired.
    }
    clearPairing();
    setSession(null);
    setPairing(null);
  };

  const openDevice = () => {
    if (!pairing) return;
    if (pairing.mode === "kiosk") {
      navigate({
        to: "/companion/events/$eventId/kiosk",
        params: { eventId: pairing.eventId },
      });
    } else {
      navigate({
        to: "/companion/events/$eventId/scanner",
        params: { eventId: pairing.eventId },
      });
    }
  };

  const goJoin = () => {
    navigate({ to: "/companion/join" });
  };

  const copyLink = async () => {
    if (!pairing) return;
    const url = `${window.location.origin}/companion/events/${pairing.eventId}/${pairing.mode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context); ignore
    }
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="back to home"
            onClick={() => navigate({ to: "/" })}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Companion Devices
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
            <Button
              color="inherit"
              size="small"
              onClick={() => void handleLogout()}
            >
              Log out
            </Button>
          }
        >
          An administrator is still signed in on this browser. On a guest-facing
          device, log out so no one else can reach the admin pages.
        </Alert>
      )}

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {/* While the local session check is in flight, render just the shell. */}
        {pairing && session && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardHeader
              avatar={
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  {pairing.mode === "scanner" ? (
                    <PhoneAndroidIcon />
                  ) : (
                    <DesktopWindowsIcon />
                  )}
                </Avatar>
              }
              title={session.name}
              slotProps={{
                title: { variant: "subtitle1", fontWeight: 600 },
                subheader: { component: "div" },
              }}
              subheader={
                <Chip
                  size="small"
                  variant="outlined"
                  label={modeLabel(pairing.mode)}
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
                  copied ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" />
                  )
                }
                onClick={() => void copyLink()}
              >
                Copy link
              </Button>
              <Box>
                <Tooltip title="Unpair this device">
                  <IconButton
                    aria-label="Unpair this device"
                    onClick={() => setConfirmUnpair(true)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  endIcon={<LaunchIcon />}
                  onClick={openDevice}
                >
                  Open
                </Button>
              </Box>
            </CardActions>
          </Card>
        )}

        {loaded && !pairing && (
          <EmptyState
            icon={<DeviceUnknownIcon />}
            actions={
              <Button variant="contained" onClick={goJoin}>
                Pair this device
              </Button>
            }
          >
            This device is not paired with any event.
          </EmptyState>
        )}
      </Container>

      {pairing && (
        <Fab
          color="primary"
          aria-label="Pair a new device"
          onClick={goJoin}
          sx={{ position: "fixed", bottom: 24, right: 24 }}
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog
        open={confirmUnpair}
        onClose={() => setConfirmUnpair(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Unpair this device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The kiosk/scanner session on this browser stops working until you
            pair again. Camera settings are kept.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnpair(false)}>Cancel</Button>
          <Button color="error" onClick={() => void handleUnpair()}>
            Unpair
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
