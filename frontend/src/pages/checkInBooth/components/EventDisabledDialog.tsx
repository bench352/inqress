import { Box, Dialog, Typography } from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";

export default function EventDisabledDialog() {
  return (
    <Dialog open fullScreen>
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          p: 8,
        }}
      >
        <HourglassEmptyIcon sx={{ fontSize: 128 }} />
        <Typography variant="h4" sx={{ textAlign: "center" }}>
          Please wait while the event organizer starts the check-in.
        </Typography>
      </Box>
    </Dialog>
  );
}
