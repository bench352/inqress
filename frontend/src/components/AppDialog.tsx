import type { ReactNode } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  type DialogProps,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { useFullScreenDialog } from "@/hooks/useFullScreenDialog";

export function AppDialogTitle({
  title,
  titleEnd,
  onClose,
}: {
  title: ReactNode;
  titleEnd?: ReactNode;
  onClose: () => void;
}) {
  return (
    <DialogTitle component="div">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          {title}
        </Box>
        {titleEnd}
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>
    </DialogTitle>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional action next to the close button, such as a ticket preview. */
  titleEnd?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: DialogProps["maxWidth"];
  contentSx?: SxProps<Theme>;
  paperSx?: SxProps<Theme>;
}

/**
 * Frame for a working dialog: title with a close button, scrolling content,
 * and text-only actions. Confirmations keep the plain MUI dialog.
 */
export default function AppDialog({
  open,
  onClose,
  title,
  titleEnd,
  children,
  actions,
  maxWidth = "sm",
  contentSx,
  paperSx,
}: Props) {
  const fullScreen = useFullScreenDialog();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={fullScreen}
      scroll="paper"
      slotProps={paperSx ? { paper: { sx: paperSx } } : undefined}
    >
      <AppDialogTitle title={title} titleEnd={titleEnd} onClose={onClose} />
      <DialogContent dividers sx={contentSx}>
        {children}
      </DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
