import { useMemo, useState } from "react";
import {
  Alert,
  Card,
  CardActionArea,
  CardContent,
  Fab,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
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
import EmptyState from "@/components/EmptyState";
import SectionHeading from "@/components/SectionHeading";

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

  const handleCreate = async (payload: {
    name: string;
    description: string;
    date: string;
  }) => {
    const created = await createEvent(payload);
    navigate({
      to: "/admin/events/$eventId",
      params: { eventId: created.id },
    });
  };

  return (
    <>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 900 }}>
          {orgName ? `Welcome, ${orgName}!` : "Welcome!"}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <SectionHeading icon={<EventIcon />}>Your events</SectionHeading>
          <TextField
            size="small"
            placeholder="Search events by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: { sm: 280 } }}
            slotProps={{
              htmlInput: { "aria-label": "Search events by name" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear search"
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

        {isError && <Alert severity="error">Cannot load events</Alert>}

        {isLoading && <LinearProgress aria-label="Loading events" />}

        {!isLoading && events.length === 0 && (
          <EmptyState icon={<EventIcon />}>
            No events yet. Create one to start adding people.
          </EmptyState>
        )}

        {events.length > 0 && filteredEvents.length === 0 && (
          <Typography color="textSecondary">No matches found.</Typography>
        )}

        <Grid container spacing={2}>
          {filteredEvents.map((event) => (
            <Grid key={event.id} size={{ xs: 12, sm: 6 }}>
              <Card sx={{ height: "100%" }} variant="outlined">
                <CardActionArea
                  onClick={() =>
                    navigate({
                      to: "/admin/events/$eventId",
                      params: { eventId: event.id },
                    })
                  }
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Typography variant="h6" component="h2" noWrap>
                      {event.name}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        mb: 0.25,
                      }}
                    >
                      {event.description || "No description"}
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
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
        aria-label="Add event"
        onClick={() => setDialogOpen(true)}
        sx={{ position: "fixed", bottom: 24, right: 24 }}
      >
        <AddIcon sx={{ mr: 1 }} />
        Add event
      </Fab>

      <AddEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        loading={isCreating}
      />
    </>
  );
}
