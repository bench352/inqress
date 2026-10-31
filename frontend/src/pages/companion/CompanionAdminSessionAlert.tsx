import { useState } from "react";
import { Snackbar } from "@mui/material";

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
      message="Admin session has been logged out for security."
      onClose={() => setDismissed(true)}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
    />
  );
}
