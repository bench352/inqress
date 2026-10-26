import { Divider, Grid, Typography } from "@mui/material";
import type { ParticipantItem } from "../pages/eventDetail/useEventDetail";
import { ParticipantCard } from "../pages/eventDetail/components/ParticipantCard";

interface Props {
  participants: ParticipantItem[];
  title: string;
  onClick: (participantId: string) => void;
  id?: string;
}

export default function ParticipantGrid({
  participants,
  title,
  onClick,
  id,
}: Props) {
  if (participants.length === 0) return null;

  return (
    <>
      <Divider id={id}>
        <Typography variant="h6" color="textSecondary">
          {title}
        </Typography>
      </Divider>

      <Grid container spacing={2}>
        {participants.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6 }}>
            <ParticipantCard participant={a} onClick={() => onClick(a.id)} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}
