import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useApi } from "../api";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";

interface Props {
  eventId: string;
  eventName: string;
}

const COMMANDS = [
  {
    icon: VisibilityIcon,
    command: "SHOW_CAMERA_PREVIEW",
    label: "Show Camera",
  },
  {
    icon: VisibilityOffIcon,
    command: "HIDE_CAMERA_PREVIEW",
    label: "Hide Camera",
  },
  { icon: RestartAltIcon, command: "REFRESH", label: "Refresh" },
  { icon: PowerSettingsNewIcon, command: "CLOSE", label: "Close" },
] as const;

export default function BoothControlPanel({ eventId, eventName }: Props) {
  const api = useApi();
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const handleCommand = useCallback(
    async (command: string) => {
      setLoadingCommand(command);
      try {
        await api.post(`/api/events/${eventId}/checkInBooth/command`, {
          command,
          params: {},
        });
      } catch {
        // errors handled by global handler
      } finally {
        setLoadingCommand(null);
      }
    },
    [eventId, api],
  );

  const handleClick = useCallback(
    (command: string) => {
      if (command === "CLOSE") {
        setCloseDialogOpen(true);
      } else {
        handleCommand(command);
      }
    },
    [handleCommand],
  );

  const handleConfirmClose = useCallback(() => {
    setCloseDialogOpen(false);
    handleCommand("CLOSE");
  }, [handleCommand]);

  const handleCancelClose = useCallback(() => {
    setCloseDialogOpen(false);
  }, []);

  return (
    <Box sx={{ px: 2, py: 0, pb: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {eventName}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        {COMMANDS.map(({ icon: Icon, command }) => (
          <Button
            key={command}
            variant="outlined"
            size="small"
            onClick={() => handleClick(command)}
            disabled={loadingCommand !== null}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
              minHeight: 40,
              px: 1,
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Button>
        ))}
      </Box>
      <Dialog open={closeDialogOpen} onClose={handleCancelClose}>
        <DialogTitle>
          Confirm closing check-in booth for "{eventName}"
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            The booth screen will be closed and you'll need to start it manually
            if you wish to use it again.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClose}>Cancel</Button>
          <Button
            onClick={handleConfirmClose}
            color="error"
            variant="contained"
          >
            Close Booth
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
