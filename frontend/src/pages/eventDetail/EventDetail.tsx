import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ClearIcon from "@mui/icons-material/Clear";
import GroupIcon from "@mui/icons-material/Group";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PhonelinkIcon from "@mui/icons-material/Phonelink";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useMatches,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { useEventDetail, type ParticipantItem } from "./useEventDetail";
import type { EventSearch } from "./types";
import AddParticipantsButton from "./components/AddParticipantsButton";
import ActionsSection from "./components/ActionsSection";
import ParticipantDetailsDialog from "./components/ParticipantDetailsDialog";
import AttendanceSummary from "./components/AttendanceSummary";
import ImportResultDialog from "./components/ImportResultDialog";
import ModeDialog from "./components/ModeDialog";
import PairCompanionDialog from "./components/PairCompanionDialog";
import ParticipantGrid from "@/components/ParticipantGrid";
import EmptyState from "@/components/EmptyState";
import SectionHeading from "@/components/SectionHeading";
import { useApi } from "@/api.ts";
import DataSourceSyncProvider from "../../providers/DataSourceSyncProvider";
import { useDebounce } from "@/hooks/useDebounce.ts";
import { useEventStream } from "../../hooks/useEventStream";

export default function EventDetail() {
  const { eventId } = useParams({ from: "/app-shell/admin/events/$eventId" });
  const search = useSearch({ from: "/app-shell/admin/events/$eventId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const api = useApi();
  const { enqueueSnackbar } = useSnackbar();
  const {
    event,
    isEventLoading,
    participants,
    attended,
    isParticipantsLoading,
    updateMode,
    isUpdatingMode,
  } = useEventDetail(eventId);

  const {
    createParticipantProgress,
    sendEmailProgress,
    generateTicketQrProgress,
    resultDialog,
    dismissResultDialog,
    dataSourceSync,
  } = useEventStream(eventId, queryClient);

  // Child pages replace the event detail view. They opt in from the router so that
  // adding a route is enough to get the layout right.
  const matches = useMatches();
  const isChildRouteActive = matches.some((m) => m.staticData?.childPage);

  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [companionToken, setCompanionToken] = useState<string | null>(null);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const debouncedParticipantSearchQuery = useDebounce(
    participantSearchQuery,
    100,
  );

  const selectedParticipant = search.participant
    ? (participants.find((a) => a.id === search.participant) ?? null)
    : null;
  const pairOpen = search.pair === true;

  const go = useCallback(
    (next: EventSearch, replace = false) =>
      navigate({
        to: "/admin/events/$eventId",
        params: { eventId },
        search: next,
        replace,
      }),
    [navigate, eventId],
  );

  // One dialog at a time: pair wins over a participant, and a step without a
  // participant or an unknown id is not worth keeping in the URL.
  useEffect(() => {
    if (search.pair) {
      if (search.participant || search.step) go({ pair: true }, true);
      return;
    }
    if (search.step && !search.participant) {
      go({}, true);
      return;
    }
    if (
      search.participant &&
      !isParticipantsLoading &&
      participants.length > 0 &&
      !selectedParticipant
    ) {
      go({}, true);
    }
  }, [
    search,
    isParticipantsLoading,
    participants.length,
    selectedParticipant,
    go,
  ]);

  useEffect(() => {
    if (!pairOpen) return;
    let cancelled = false;
    api
      .get<{ token: string }>(`/api/admin/events/${eventId}/companion/token`)
      .then((t) => {
        if (!cancelled) setCompanionToken(t.token);
      })
      .catch(() => {
        if (!cancelled) {
          enqueueSnackbar("Could not load the pairing code. Try again.", {
            variant: "error",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pairOpen, eventId, api, enqueueSnackbar]);

  const handleModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: string | null,
  ) => {
    if (newMode && newMode !== event?.mode) {
      setPendingMode(newMode);
      setModeDialogOpen(true);
    }
  };

  const handleModeConfirm = () => {
    if (pendingMode) {
      updateMode(pendingMode, {
        onSuccess: () => setModeDialogOpen(false),
      });
    }
  };

  const handleRotateToken = async () => {
    try {
      const t = await api.post<{ token: string }>(
        `/api/admin/events/${eventId}/companion/rotate`,
      );
      setCompanionToken(t.token);
      enqueueSnackbar(
        "New pairing code generated. Existing devices will need to be paired again.",
        { variant: "success" },
      );
    } catch {
      enqueueSnackbar("Could not rotate the pairing code. Try again.", {
        variant: "error",
      });
    }
  };

  const closePair = () => {
    setCompanionToken(null);
    go({}, true);
  };

  const totalCount = participants.length;
  const attendedCount = attended.length;

  const {
    attended: filteredAttended,
    pending: filteredPending,
    notAttended: filteredNotAttended,
    notDelivered: filteredNotDelivered,
    ticketUndelivered: filteredTicketUndelivered,
    deactivated: filteredDeactivated,
  } = useMemo(() => {
    const query = debouncedParticipantSearchQuery.toLowerCase();
    const byName = (a: ParticipantItem, b: ParticipantItem) =>
      a.name.localeCompare(b.name);
    const attended: ParticipantItem[] = [];
    const pending: ParticipantItem[] = [];
    const notAttended: ParticipantItem[] = [];
    const notDelivered: ParticipantItem[] = [];
    const ticketUndelivered: ParticipantItem[] = [];
    const deactivated: ParticipantItem[] = [];
    for (const p of participants) {
      if (!p.name.toLowerCase().includes(query)) continue;
      if (p.checkedInAt != null) attended.push(p);
      else if (p.activated == null) pending.push(p);
      else if (p.activated === false) deactivated.push(p);
      else if (!p.isTicketReady) ticketUndelivered.push(p);
      else if (!p.isTicketDelivered) notDelivered.push(p);
      else notAttended.push(p);
    }
    attended.sort((a, b) =>
      (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""),
    );
    pending.sort(byName);
    notAttended.sort(byName);
    notDelivered.sort(byName);
    ticketUndelivered.sort(byName);
    deactivated.sort(byName);
    return {
      attended,
      pending,
      notAttended,
      notDelivered,
      ticketUndelivered,
      deactivated,
    };
  }, [participants, debouncedParticipantSearchQuery]);

  const undeliveredReadyCount = participants.filter(
    (a) =>
      a.isTicketReady &&
      !a.isTicketDelivered &&
      a.email &&
      a.activated === true,
  ).length;
  const pendingCount = participants.filter((a) => a.activated == null).length;
  const notReadyCount = participants.filter((a) => !a.isTicketReady).length;
  const notReadyIds = participants
    .filter((a) => a.checkedInAt == null && !a.isTicketReady)
    .map((a) => a.id);

  const hasActionsContent =
    filteredPending.length > 0 ||
    undeliveredReadyCount > 0 ||
    notReadyCount > 0 ||
    !!createParticipantProgress?.inProgress ||
    !!sendEmailProgress?.inProgress ||
    !!generateTicketQrProgress?.inProgress;

  if (isChildRouteActive) {
    return (
      <DataSourceSyncProvider value={dataSourceSync}>
        <Outlet />
        {resultDialog && (
          <ImportResultDialog
            eventId={eventId}
            resultId={resultDialog.resultId}
            onClose={dismissResultDialog}
          />
        )}
      </DataSourceSyncProvider>
    );
  }

  if (isEventLoading || !event) {
    return <LinearProgress />;
  }

  const actionButtonWidth = { xs: "100%", sm: "auto" };

  return (
    <Stack spacing={2} sx={{ pb: 10 }}>
      <Card variant="outlined">
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1">
              {event.name}
            </Typography>
            <Typography variant="body1">
              {event.description || "(No description)"}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Chip
                icon={<CalendarTodayIcon sx={{ pl: "4px" }} />}
                label={event.date}
                // variant="outlined"
              />
              <Chip
                icon={<GroupIcon sx={{ pl: "4px" }} />}
                label={`${totalCount} participant${totalCount === 1 ? "" : "s"}`}
                // variant="outlined"
              />
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap" }}
              >
                <ToggleButtonGroup
                  color="primary"
                  exclusive
                  value={event.mode}
                  onChange={handleModeChange}
                  disabled={isUpdatingMode}
                  size="small"
                >
                  <ToggleButton value="disabled">Disabled</ToggleButton>
                  <ToggleButton value="test">Test</ToggleButton>
                  <ToggleButton value="live">Live</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="body1" color="textSecondary">
                  Attendance mode
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<PhonelinkIcon />}
                  onClick={() => go({ pair: true })}
                  sx={{ width: actionButtonWidth }}
                >
                  Link companion
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SettingsIcon />}
                  onClick={() =>
                    navigate({
                      to: "/admin/events/$eventId/settings",
                      params: { eventId },
                      search: {},
                    })
                  }
                  sx={{ width: actionButtonWidth }}
                >
                  Settings
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </Box>
        <Collapse in={event.mode !== "disabled"}>
          <Divider />
          <AttendanceSummary
            totalCount={totalCount}
            attendedCount={attendedCount}
          />
        </Collapse>
      </Card>

      {hasActionsContent && (
        <ActionsSection
          eventId={eventId}
          pendingCount={pendingCount}
          undeliveredReadyCount={undeliveredReadyCount}
          notReadyCount={notReadyCount}
          notReadyIds={notReadyIds}
          createParticipantProgress={createParticipantProgress}
          sendEmailProgress={sendEmailProgress}
          generateTicketQrProgress={generateTicketQrProgress}
        />
      )}

      {isParticipantsLoading && <LinearProgress />}

      {totalCount === 0 && !isParticipantsLoading && (
        <EmptyState
          icon={<PeopleAltIcon />}
          actions={
            <Stack spacing={0} sx={{ alignItems: "center" }}>
              <Button
                sx={{ color: "text.secondary" }}
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/addParticipantsManually",
                    params: { eventId },
                  })
                }
              >
                Add manually
              </Button>
              <Button
                sx={{ color: "text.secondary" }}
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/addParticipantsBySpreadsheet",
                    params: { eventId },
                  })
                }
              >
                Import spreadsheet
              </Button>
              <Button
                sx={{ color: "text.secondary" }}
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/dataSources",
                    params: { eventId },
                  })
                }
              >
                Add data source
              </Button>
            </Stack>
          }
        >
          No participants yet. Bring your guests in by data sources or by hand.
        </EmptyState>
      )}

      {totalCount > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <SectionHeading icon={<GroupIcon />}>Participants</SectionHeading>
          <TextField
            size="small"
            placeholder="Search participants by name…"
            value={participantSearchQuery}
            onChange={(e) => setParticipantSearchQuery(e.target.value)}
            sx={{ minWidth: { sm: 280 } }}
            slotProps={{
              htmlInput: { "aria-label": "Search participants by name" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: participantSearchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear search"
                      onClick={() => setParticipantSearchQuery("")}
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
      )}

      {filteredPending.length > 0 && (
        <ParticipantGrid
          id="pending-participants"
          participants={filteredPending}
          title="To be admitted"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {filteredAttended.length > 0 && (
        <ParticipantGrid
          participants={filteredAttended}
          title="Attended"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {filteredNotAttended.length > 0 && (
        <ParticipantGrid
          participants={filteredNotAttended}
          title="Not attended"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {filteredNotDelivered.length > 0 && (
        <ParticipantGrid
          participants={filteredNotDelivered}
          title="Ticket not delivered"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {filteredTicketUndelivered.length > 0 && (
        <ParticipantGrid
          participants={filteredTicketUndelivered}
          title="Ticket not ready"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {filteredDeactivated.length > 0 && (
        <ParticipantGrid
          participants={filteredDeactivated}
          title="Deactivated"
          onClick={(id) => go({ participant: id })}
        />
      )}

      {totalCount > 0 &&
        filteredPending.length === 0 &&
        filteredAttended.length === 0 &&
        filteredNotAttended.length === 0 &&
        filteredNotDelivered.length === 0 &&
        filteredTicketUndelivered.length === 0 &&
        filteredDeactivated.length === 0 && (
          <Typography color="textSecondary">No matches found.</Typography>
        )}

      <AddParticipantsButton eventId={eventId} />

      {resultDialog && (
        <ImportResultDialog
          eventId={eventId}
          resultId={resultDialog.resultId}
          onClose={dismissResultDialog}
        />
      )}

      <ModeDialog
        open={modeDialogOpen}
        currentMode={event.mode}
        pendingMode={pendingMode}
        loading={isUpdatingMode}
        onClose={() => setModeDialogOpen(false)}
        onConfirm={handleModeConfirm}
      />

      <PairCompanionDialog
        open={pairOpen}
        eventId={eventId}
        companionToken={companionToken}
        onRotate={handleRotateToken}
        onClose={closePair}
      />

      {selectedParticipant && (
        <ParticipantDetailsDialog
          participant={selectedParticipant}
          eventId={eventId}
          eventName={event.name}
          eventMode={event.mode}
          step={search.step ?? null}
          onStep={(step) =>
            go(
              step
                ? { participant: selectedParticipant.id, step }
                : { participant: selectedParticipant.id },
              false,
            )
          }
          onClose={() => go({}, true)}
        />
      )}
    </Stack>
  );
}
