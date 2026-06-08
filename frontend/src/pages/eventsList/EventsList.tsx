import { useMemo, useState } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  Fab,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import EventIcon from "@mui/icons-material/Event";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "@tanstack/react-router";
import { useEvents } from "./useEvents";
import AddEventDialog from "./components/AddEventDialog";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";

import { useAppInfo } from "@/providers/useAppInfo.ts";
import { useDebounce } from "@/hooks/useDebounce";

export default function EventsList() {
  const { events, isLoading, createEvent, isCreating, isError } = useEvents();
  const { orgName } = useAppInfo();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const navigate = useNavigate();

  const filteredEvents = useMemo(
    () =>
      [...events]
        .filter(
          (e) =>
            e.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
            (e.description ?? "")
              .toLowerCase()
              .includes(debouncedSearchQuery.toLowerCase()),
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [events, debouncedSearchQuery],
  );

  return (
    <>
      <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
        {orgName ? `Welcome, ${orgName}!` : "Welcome!"}
      </Typography>
      <Stack direction="column" spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <EventIcon />
            <Typography variant="h5" color="text.secondary">
              Your events
            </Typography>
          </Stack>
          <TextField
            variant="standard"
            size="small"
            placeholder="Search events by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: 280 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="clear search"
                      onClick={() => setSearchQuery("")}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
        </Stack>

        {isError && <Alert severity="error">Cannot load event</Alert>}

        {isLoading && <LinearProgress aria-label="Loading…" />}

        <Grid container spacing={2}>
          {filteredEvents.map((event) => (
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
                      variant="body1"
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
      </Stack>
      <Fab
        color="secondary"
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
