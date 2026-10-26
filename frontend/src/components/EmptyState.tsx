import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface Props {
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

/** Centred icon and message for a list with nothing in it yet. */
export default function EmptyState({ icon, children, actions }: Props) {
  return (
    <Stack
      spacing={2}
      sx={{ alignItems: "center", textAlign: "center", py: 6 }}
    >
      <Box
        sx={{
          display: "flex",
          color: "text.disabled",
          "& svg": { fontSize: 64 },
        }}
      >
        {icon}
      </Box>
      <Typography color="textSecondary" sx={{ maxWidth: 360 }}>
        {children}
      </Typography>
      {actions}
    </Stack>
  );
}
