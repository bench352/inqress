import { Divider, Grid, Stack, Typography } from "@mui/material";
import type { ParticipantItem } from "../pages/eventDetail/useEventDetail";
import { ParticipantCard } from "../pages/eventDetail/components/ParticipantCard";

interface Props {
  participants: ParticipantItem[];
  title: string;
  onClick: (participantId: string) => void;
}

export default function ParticipantGrid({
  participants,
  title,
  onClick,
}: Props) {
  if (participants.length === 0) return null;

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="subtitle1" color="text.secondary">
          {title}
        </Typography>
        <Divider sx={{ flexGrow: 1 }} />
      </Stack>
      <Grid container spacing={2}>
        {participants.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <ParticipantCard participant={a} onClick={() => onClick(a.id)} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}
