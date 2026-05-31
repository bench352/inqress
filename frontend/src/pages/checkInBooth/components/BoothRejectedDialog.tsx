import { Box, Button, Dialog, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";

interface Props {
  eventId: string;
}

export default function BoothRejectedDialog({ eventId }: Props) {
  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      window.location.href = `/full-page/events/${eventId}`;
    }
  };

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
        <BlockIcon sx={{ fontSize: 128, color: "error.main" }} />
        <Typography
          variant="h4"
          color="text.secondary"
          sx={{ textAlign: "center" }}
        >
          This booth is already open in another window.
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: "center" }}
        >
          Please close the other window first.
        </Typography>
        <Button variant="contained" size="large" onClick={handleClose}>
          Close
        </Button>
      </Box>
    </Dialog>
  );
}
