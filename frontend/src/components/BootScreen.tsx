import { useEffect, useState } from "react";
import { Box, Fade, Portal, Stack, Typography } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import { brandFontFamily } from "@/brandFont.ts";

/**
 * Full-page wait shown while the app is not ready yet: a route chunk still
 * downloading, or the app info request right after login.
 * Portaled so a nested route's pending fallback still covers the shell until
 * this unmounts. The white layer does not fade; only the name and bar do,
 * and only after Reglo is loaded, so font-display:swap cannot flash the
 * fallback face on this screen.
 */
export default function BootScreen() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Weight must match the @font-face in reglo.css, or the face is not loaded.
    document.fonts.load('700 16px "Reglo"').finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Portal>
      <Box
        sx={(theme) => ({
          position: "fixed",
          inset: 0,
          zIndex: theme.zIndex.modal,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#fff",
        })}
      >
        <Fade in={ready} timeout={1000}>
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            <Typography
              variant="h2"
              sx={{ fontFamily: brandFontFamily, fontWeight: 700 }}
            >
              InQRess
            </Typography>
            <LinearProgress sx={{ width: 120 }} color="inherit" />
          </Stack>
        </Fade>
      </Box>
    </Portal>
  );
}
