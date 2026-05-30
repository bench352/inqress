import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
} from "@mui/material";
import { Scanner, useDevices } from "@yudiel/react-qr-scanner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function WebcamSettingsDialog({ open, onClose }: Props) {
  const devices = useDevices();
  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const savedDeviceId = localStorage.getItem("settings.webcamDeviceId") || "";
  const [deviceId, setDeviceId] = useState(savedDeviceId);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarKey, setSnackbarKey] = useState(0);

  const handleScan = (detectedCodes: { rawValue: string }[]) => {
    if (detectedCodes.length > 0) {
      setSnackbarMessage(detectedCodes[0].rawValue);
      setSnackbarKey((k) => k + 1);
      setSnackbarOpen(true);
    }
  };

  const handleSave = () => {
    localStorage.setItem("settings.webcamDeviceId", deviceId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle>Webcam Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ height: "100%", mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Camera</InputLabel>
            <Select
              value={deviceId}
              label="Camera"
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {videoDevices.map((d) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera (${d.deviceId.slice(0, 8)}...)`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box
            sx={{
              flex: 1,
              position: "relative",
              bgcolor: "black",
              borderRadius: 1,
              overflow: "hidden",
              minHeight: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Scanner
              key={deviceId || "default"}
              onScan={handleScan}
              constraints={{ deviceId: deviceId || undefined }}
              components={{
                finder: false,
                torch: false,
                onOff: false,
                zoom: false,
              }}
              sound={false}
              allowMultiple
              scanDelay={500}
              styles={{
                container: {
                  width: "100%",
                  height: "100%",
                  aspectRatio: "auto",
                },
                video: {
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
      <Snackbar
        key={snackbarKey}
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={`Scanned: ${snackbarMessage}`}
      />
    </Dialog>
  );
}
