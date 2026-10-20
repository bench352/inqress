import { forwardRef } from "react";
import { Alert } from "@mui/material";
import { useSnackbar, type CustomContentProps } from "notistack";

/**
 * Snackbar content as an MUI Alert, per MUI's "Use with Alerts" example:
 * https://mui.com/material-ui/react-snackbar/#use-with-alerts
 *
 * notistack measures the snackbar through a ref on its content, so this must forward one.
 */
export default forwardRef<HTMLDivElement, CustomContentProps>(
  function SnackbarAlert(
    { id, message, action, variant, style, className },
    ref,
  ) {
    const { closeSnackbar } = useSnackbar();

    return (
      <Alert
        ref={ref}
        className={className}
        style={style}
        severity={variant === "default" ? "info" : variant}
        variant="filled"
        onClose={() => closeSnackbar(id)}
        action={typeof action === "function" ? action(id) : action}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    );
  },
);
