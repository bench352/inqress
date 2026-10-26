import { useMediaQuery, useTheme } from "@mui/material";

/** Working dialogs fill the screen on a phone; confirmation dialogs do not. */
export function useFullScreenDialog() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}
