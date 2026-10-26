import type { ReactNode } from "react";
import { IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  action?: ReactNode;
}

/** Page heading with a back button, used by every page below the event. */
export default function PageHeader({ title, subtitle, onBack, action }: Props) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{ alignItems: { xs: "stretch", sm: "center" } }}
    >
      <Stack
        direction="row"
        spacing={0}
        sx={{ alignItems: "center", flexGrow: 1, minWidth: 0 }}
      >
        <IconButton
          size="large"
          aria-label="Go back"
          onClick={onBack}
          sx={{ flexShrink: 0 }}
        >
          <ArrowBackIcon fontSize="inherit" />
        </IconButton>
        <Stack spacing={0} sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h1" noWrap>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="subtitle2" color="textSecondary" noWrap>
              {subtitle}
            </Typography>
          )}
        </Stack>
      </Stack>
      {action}
    </Stack>
  );
}
