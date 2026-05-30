import { useMemo, useState } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  Fab,
  Grid,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "@tanstack/react-router";
import { useEvents } from "./useEvents";
import AddEventDialog from "./components/AddEventDialog";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";

export default function EventsList() {
  const { events, isLoading, createEvent, isCreating, isError } = useEvents();
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events],
  );

  return (
    <>
      <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
        Events
      </Typography>

      {isError && <Alert severity="error">Cannot load event</Alert>}

      {isLoading && <LinearProgress aria-label="Loading…" />}

      <Grid container spacing={2}>
        {sortedEvents.map((event) => (
          <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea
                onClick={() =>
                  navigate({
                    to: "/events/$eventId",
                    params: { eventId: event.id },
                  })
                }
                sx={{ height: "100%" }}
              >
                <CardContent>
                  <Typography variant="h6" component="h2" gutterBottom noWrap>
                    {event.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      mb: 1,
                    }}
                  >
                    {event.description || "No description"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {event.date}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Fab
        color="primary"
        variant="extended"
        onClick={() => setDialogOpen(true)}
        sx={{ position: "fixed", bottom: 24, right: 24 }}
      >
        <AddIcon sx={{ mr: 1 }} />
        Add event
      </Fab>

      <AddEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={createEvent}
        loading={isCreating}
      />
    </>
  );
}
