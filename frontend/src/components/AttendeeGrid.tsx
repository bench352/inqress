import { Grid, Typography } from "@mui/material";
import type { AttendeeItem } from "../pages/eventDetail/useEventDetail";
import AttendeeCard from "../pages/eventDetail/components/AttendeeCard";

interface Props {
  attendees: AttendeeItem[];
  title: string;
  onClick: (attendeeId: string) => void;
}

export default function AttendeeGrid({ attendees, title, onClick }: Props) {
  if (attendees.length === 0) return null;

  return (
    <>
      <Typography variant="subtitle1">{title}</Typography>
      <Grid container spacing={2}>
        {attendees.map((a) => (
          <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <AttendeeCard attendee={a} onClick={() => onClick(a.id)} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}
