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
  Stack,
} from "@mui/material";
import { Scanner, useDevices } from "@yudiel/react-qr-scanner";

const CAMERA_KEY = "settings.webcamDeviceId";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CameraSettingsDialog({ open, onClose }: Props) {
  const devices = useDevices();
  const videoDevices = devices.filter((d) => d.kind === "videoinput");
  const [deviceId, setDeviceId] = useState(
    () => localStorage.getItem(CAMERA_KEY) || "",
  );

  const handleSave = () => {
    localStorage.setItem(CAMERA_KEY, deviceId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle>Switch camera</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ height: "100%", mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Camera</InputLabel>
            <Select
              value={deviceId}
              label="Camera"
              onChange={(e) => setDeviceId(e.target.value)}
            >
              <MenuItem value="">Device default</MenuItem>
              {videoDevices.map((d) => (
                <MenuItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera (${d.deviceId.slice(0, 8)}…)`}
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
              onScan={() => {}}
              onError={() => {}}
              constraints={
                deviceId
                  ? {
                      deviceId: { exact: deviceId },
                      width: { ideal: 1080 },
                      height: { ideal: 1920 },
                    }
                  : {
                      facingMode: "environment",
                      width: { ideal: 1080 },
                      height: { ideal: 1920 },
                    }
              }
              components={{
                finder: false,
                torch: false,
                onOff: false,
                zoom: false,
              }}
              sound={false}
              styles={{
                container: {
                  width: "100%",
                  height: "100%",
                  aspectRatio: "9 / 16",
                },
                video: { width: "100%", height: "100%", objectFit: "cover" },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
