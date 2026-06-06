import { Grid, Typography } from "@mui/material";
import type { ParticipantItem } from "../pages/eventDetail/useEventDetail";
import ParticipantCard from "../pages/eventDetail/components/ParticipantCard";

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
      <Typography variant="subtitle1">{title}</Typography>
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
