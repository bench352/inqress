import type { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";

/** Icon + heading, matching the Participants and Actions sections. */
export default function SectionHeading({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {icon}
      <Typography variant="h5" component="h2">
        {children}
      </Typography>
    </Stack>
  );
}
