import { useMemo, useState } from "react";
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
import EditIcon from "@mui/icons-material/Edit";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import GroupIcon from "@mui/icons-material/Group";
import SearchIcon from "@mui/icons-material/Search";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useMatches,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { useEventDetail, type ParticipantItem } from "./useEventDetail";
import AddParticipantsSpeedDial from "./components/AddParticipantsSpeedDial";
import ActionsSection from "./components/ActionsSection";
import ParticipantDetailsDialog from "./components/ParticipantDetailsDialog";
import AttendanceSummary from "./components/AttendanceSummary";
import CheckinNotificationDialog from "./components/CheckinNotificationDialog";
import DateDialog from "./components/DateDialog";
import ImportResultDialog from "./components/ImportResultDialog";
import ModeDialog from "./components/ModeDialog";
import ModifyEventsDialog from "./components/ModifyEventsDialog";
import PairCompanionDialog from "./components/PairCompanionDialog";
import ParticipantGrid from "@/components/ParticipantGrid";
import { useApi } from "@/api.ts";
import DataSourceSyncProvider from "../../providers/DataSourceSyncProvider";
import { useDebounce } from "@/hooks/useDebounce.ts";
import { useEventStream } from "../../hooks/useEventStream";

export default function EventDetail() {
  const { eventId } = useParams({ from: "/app-shell/admin/events/$eventId" });
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
    updateEvent,
    isUpdating,
    updateMode,
    isUpdatingMode,
    deleteEvent,
    isDeleting,
  } = useEventDetail(eventId);

  const {
    createParticipantProgress,
    sendEmailProgress,
    generateTicketQrProgress,
    resultDialog,
    dismissResultDialog,
    attendanceDialog,
    dismissAttendanceDialog,
    dataSourceSync,
  } = useEventStream(eventId, queryClient);

  // Child pages replace the event detail view. They opt in from the router so that
  // adding a route is enough to get the layout right.
  const matches = useMatches();
  const isChildRouteActive = matches.some((m) => m.staticData?.childPage);

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pairDialogOpen, setPairDialogOpen] = useState(false);
  const [companionToken, setCompanionToken] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const debouncedParticipantSearchQuery = useDebounce(
    participantSearchQuery,
    100,
  );

  const selectedParticipant = selectedParticipantId
    ? (participants.find((a) => a.id === selectedParticipantId) ?? null)
    : null;

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

  const handleDateSave = (date: string) => {
    if (!event) return;
    updateEvent({
      name: event.name,
      description: event.description,
      date,
    });
    setDateDialogOpen(false);
  };

  const handleSettingsSave = (data: {
    name: string;
    description: string;
    date: string;
    hasBoothImage: boolean;
  }) => {
    updateEvent({
      name: data.name,
      description: data.description,
      date: data.date,
    });
  };

  const handleDeleteEvent = () => {
    deleteEvent(undefined, {
      onSuccess: () => {
        navigate({ to: "/admin/events" });
      },
    });
  };

  const openPairDialog = async () => {
    try {
      const t = await api.get<{ token: string }>(
        `/api/admin/events/${eventId}/companion/token`,
      );
      setCompanionToken(t.token);
      setPairDialogOpen(true);
    } catch {
      enqueueSnackbar("Failed to load pairing token", { variant: "error" });
    }
  };

  const handleRotateToken = async () => {
    try {
      const t = await api.post<{ token: string }>(
        `/api/admin/events/${eventId}/companion/rotate`,
      );
      setCompanionToken(t.token);
      enqueueSnackbar(
        "Pairing token rotated - all paired devices will disconnect shortly",
        { variant: "success" },
      );
    } catch {
      enqueueSnackbar("Rotate failed", { variant: "error" });
    }
  };

  const handleClosePair = () => {
    setPairDialogOpen(false);
    setCompanionToken(null);
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

  const eventData = useMemo(() => {
    if (!event) return null;
    return {
      name: event.name,
      description: event.description,
      date: event.date,
      hasBoothImage: event.hasBoothImage,
    };
  }, [event]);

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
        {attendanceDialog && (
          <CheckinNotificationDialog
            key={attendanceDialog.participantId}
            dialog={attendanceDialog}
            onDismiss={dismissAttendanceDialog}
          />
        )}
      </DataSourceSyncProvider>
    );
  }

  if (isEventLoading || !event || !eventData) {
    return <LinearProgress />;
  }

  return (
    <Stack spacing={1.25}>
      <Card>
        <Box sx={{ p: 2 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <Typography variant="h4">{event.name}</Typography>
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon />}
              onClick={openPairDialog}
            >
              Pair companion device
            </Button>
          </Stack>
          <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
            {event.description || "No description."}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, alignItems: "center" }}
          >
            <Chip
              icon={<CalendarTodayIcon />}
              label={event.date}
              onClick={() => setDateDialogOpen(true)}
              variant="outlined"
            />
            <Chip
              icon={<GroupIcon />}
              label={`${totalCount} participants`}
              variant="outlined"
            />
          </Stack>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "flex-end" }}
          >
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
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
                attendance mode
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setSettingsDialogOpen(true)}
            >
              Modify Events
            </Button>
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

      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <GroupIcon />
          <Typography variant="h5">Participants</Typography>
        </Stack>
        <TextField
          size="small"
          variant="standard"
          placeholder="Search participants by name..."
          value={participantSearchQuery}
          onChange={(e) => setParticipantSearchQuery(e.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: participantSearchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="clear search"
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

      {filteredPending.length > 0 && (
        <Box id="pending-participants">
          <ParticipantGrid
            participants={filteredPending}
            title="To be admitted"
            onClick={(id) => setSelectedParticipantId(id)}
          />
        </Box>
      )}

      {filteredAttended.length > 0 && (
        <ParticipantGrid
          participants={filteredAttended}
          title="Attended"
          onClick={(id) => setSelectedParticipantId(id)}
        />
      )}

      {filteredNotAttended.length > 0 && (
        <ParticipantGrid
          participants={filteredNotAttended}
          title="Not Attended"
          onClick={(id) => setSelectedParticipantId(id)}
        />
      )}

      {filteredNotDelivered.length > 0 && (
        <ParticipantGrid
          participants={filteredNotDelivered}
          title="Not Delivered"
          onClick={(id) => setSelectedParticipantId(id)}
        />
      )}

      {filteredTicketUndelivered.length > 0 && (
        <ParticipantGrid
          participants={filteredTicketUndelivered}
          title="Ticket Undelivered"
          onClick={(id) => setSelectedParticipantId(id)}
        />
      )}

      {filteredDeactivated.length > 0 && (
        <ParticipantGrid
          participants={filteredDeactivated}
          title="Deactivated"
          onClick={(id) => setSelectedParticipantId(id)}
        />
      )}

      {participants.length === 0 && (
        <Typography color="textSecondary">
          No participants yet. Add some using the + button.
        </Typography>
      )}

      {participants.length > 0 &&
        filteredPending.length === 0 &&
        filteredAttended.length === 0 &&
        filteredNotAttended.length === 0 &&
        filteredNotDelivered.length === 0 &&
        filteredTicketUndelivered.length === 0 &&
        filteredDeactivated.length === 0 && (
          <Typography color="textSecondary">No matches found.</Typography>
        )}

      <AddParticipantsSpeedDial eventId={eventId} />

      {resultDialog && (
        <ImportResultDialog
          eventId={eventId}
          resultId={resultDialog.resultId}
          onClose={dismissResultDialog}
        />
      )}

      {attendanceDialog && (
        <CheckinNotificationDialog
          key={attendanceDialog.participantId}
          dialog={attendanceDialog}
          onDismiss={dismissAttendanceDialog}
        />
      )}

      <DateDialog
        open={dateDialogOpen}
        currentDate={event.date}
        loading={isUpdating}
        onClose={() => setDateDialogOpen(false)}
        onSave={handleDateSave}
      />

      <ModeDialog
        open={modeDialogOpen}
        currentMode={event.mode}
        pendingMode={pendingMode}
        loading={isUpdatingMode}
        onClose={() => setModeDialogOpen(false)}
        onConfirm={handleModeConfirm}
      />

      <ModifyEventsDialog
        open={settingsDialogOpen}
        event={eventData}
        eventId={eventId}
        isUpdating={isUpdating}
        isDeleting={isDeleting}
        onClose={() => setSettingsDialogOpen(false)}
        onUpdate={handleSettingsSave}
        onDelete={handleDeleteEvent}
      />

      <PairCompanionDialog
        open={pairDialogOpen}
        eventId={eventId}
        companionToken={companionToken}
        onRotate={handleRotateToken}
        onClose={handleClosePair}
      />

      {selectedParticipant && (
        <ParticipantDetailsDialog
          open
          participant={selectedParticipant}
          eventId={eventId}
          eventName={event.name}
          eventMode={event.mode}
          onClose={() => setSelectedParticipantId(null)}
        />
      )}
    </Stack>
  );
}
