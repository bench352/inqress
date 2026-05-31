import { useMemo } from "react";
import { Box } from "@mui/material";
import { Scanner as QrScanner } from "@yudiel/react-qr-scanner";

interface Props {
  paused: boolean;
  onScan: (detectedCodes: { rawValue: string }[]) => void;
}

export default function CameraPreview({ paused, onScan }: Props) {
  const savedDeviceId =
    localStorage.getItem("settings.webcamDeviceId") || undefined;
  const mirrorPreview =
    localStorage.getItem("settings.webcamMirrorPreview") === "true";

  const videoStyles = useMemo(
    () => (mirrorPreview ? { transform: "scaleX(-1)" } : undefined),
    [mirrorPreview],
  );

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "black",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "100%",
          position: "relative",
        }}
      >
        <QrScanner
          paused={paused}
          onScan={onScan}
          constraints={{
            deviceId: savedDeviceId,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }}
          components={{
            finder: false,
            torch: false,
            onOff: false,
            zoom: false,
          }}
          sound={false}
          styles={videoStyles ? { video: videoStyles } : undefined}
        />
      </Box>
    </Box>
  );
}
