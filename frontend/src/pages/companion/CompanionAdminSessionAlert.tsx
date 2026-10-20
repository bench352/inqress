import { useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";

/** Tells the operator that the admin session on this browser was signed out. */
export default function CompanionAdminSessionAlert({
  show,
}: {
  show: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <Snackbar
      open={show && !dismissed}
      autoHideDuration={10000}
      onClose={() => setDismissed(true)}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    >
      <Alert
        severity="warning"
        variant="filled"
        icon={<SecurityIcon />}
        onClose={() => setDismissed(true)}
      >
        Admin session has been logged out for security.
      </Alert>
    </Snackbar>
  );
}
