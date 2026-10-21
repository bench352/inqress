import { Box, Typography } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import { brandFontFamily } from "@/brandFont.ts";

/**
 * Full-page wait shown while the app is not ready yet: a route chunk still
 * downloading, or the app info request right after login.
 */
export default function BootScreen() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "#fff",
      }}
    >
      <Typography
        variant="h2"
        sx={{ fontFamily: brandFontFamily, fontWeight: 700 }}
      >
        InQRess
      </Typography>
      <LinearProgress sx={{ mt: 2, width: "120px" }} color="inherit" />
    </Box>
  );
}
