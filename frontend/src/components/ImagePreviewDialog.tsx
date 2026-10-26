import { Box, CircularProgress, Dialog } from "@mui/material";

interface Props {
  open: boolean;
  src: string | null;
  alt: string;
  onClose: () => void;
}

/** A picture only: no chrome, the paper hugs the image, a tap closes it. */
export default function ImagePreviewDialog({ open, src, alt, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          onClick: onClose,
          sx: {
            width: "auto",
            maxWidth: "calc(100% - 32px)",
            maxHeight: "calc(100% - 32px)",
            overflow: "hidden",
          },
        },
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          sx={{
            display: "block",
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: "calc(100dvh - 32px)",
            objectFit: "contain",
          }}
        />
      ) : (
        <Box sx={{ p: 4 }}>
          <CircularProgress />
        </Box>
      )}
    </Dialog>
  );
}
