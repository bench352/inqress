import { useEffect, useState } from "react";
import { Box, Fade, Portal, Stack, Typography } from "@mui/material";
import LinearProgress from "@mui/material/LinearProgress";
import { brandFontFamily } from "@/brandFont.ts";

let faded = false;

interface Props {
  open: boolean;
  /** What the current wait is loading; null leaves the reserved line empty. */
  message: string | null;
}

/**
 * Full-page wait shown while the app is not ready yet. Only the first hold of a
 * visit fades the name and bar in, after Reglo is loaded so font-display:swap
 * cannot flash the fallback face. Later holds reuse the same screen without
 * another fade.
 */
export default function BootScreen({ open, message }: Props) {
  if (!open) return null;
  return <BootScreenContent message={message} />;
}

function BootScreenContent({ message }: { message: string | null }) {
  const [ready, setReady] = useState(faded);
  const [fade] = useState(!faded);

  useEffect(() => {
    if (!fade) return;
    let cancelled = false;
    // Weight must match the @font-face in reglo.css, or the face is not loaded.
    document.fonts.load('700 16px "Reglo"').finally(() => {
      if (cancelled) return;
      faded = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fade]);

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
        <Fade in={ready} appear={false} timeout={fade ? 1000 : 0}>
          <Stack spacing={32} sx={{ alignItems: "center" }}>
            <Typography
              variant="h2"
              sx={{ fontFamily: brandFontFamily, fontWeight: 700 }}
            >
              InQRess
            </Typography>
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <LinearProgress sx={{ width: 180 }} color="inherit" />
              <Fade in={message !== null} appear={false} timeout={1000}>
                <Typography
                  variant="body1"
                  color="textSecondary"
                  noWrap
                  sx={{ maxWidth: 360 }}
                >
                  {message ?? "\u00A0"}
                </Typography>
              </Fade>
            </Stack>
          </Stack>
        </Fade>
      </Box>
    </Portal>
  );
}
