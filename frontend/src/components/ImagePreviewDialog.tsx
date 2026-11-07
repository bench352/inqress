import { Box, CircularProgress, Dialog, Typography } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import Stack from "@mui/material/Stack";

interface Props {
  open: boolean;
  src: string | null;
  alt: string;
  error?: boolean;
  onClose: () => void;
}

/** A picture only: no chrome, the paper hugs the image, a tap closes it. */
export default function ImagePreviewDialog({
  open,
  src,
  alt,
  error = false,
  onClose,
}: Props) {
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
      {error ? (
        <Stack
          direction="column"
          spacing={1}
          sx={{
            justifyContent: "center",
            alignItems: "center",
            p: 4,
          }}
        >
          <BrokenImageOutlinedIcon fontSize="large" color="error" />
          <Typography color="error">
            Image got lost on its way. Sorry about that!
          </Typography>
        </Stack>
      ) : src ? (
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
