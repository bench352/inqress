import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { QRCodeSVG } from "qrcode.react";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
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
import { useEventDetail } from "./useEventDetail";
import AddParticipantsSpeedDial from "./components/AddParticipantsSpeedDial";
import ActionsSection from "./components/ActionsSection";
import ParticipantDetailsDialog from "./components/ParticipantDetailsDialog";
import AttendanceSummary from "./components/AttendanceSummary";
import CheckinNotificationDialog from "./components/CheckinNotificationDialog";
import DateDialog from "./components/DateDialog";
import ImportResultDialog from "./components/ImportResultDialog";
import ModeDialog from "./components/ModeDialog";
import ModifyEventsDialog from "./components/ModifyEventsDialog";
import ParticipantGrid from "@/components/ParticipantGrid";
import { useApi } from "@/api.ts";
import DataSourceSyncProvider from "../../providers/DataSourceSyncProvider";
import { useDebounce } from "@/hooks/useDebounce.ts";
import { useEventStream } from "../../hooks/useEventStream";

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 1500);
    }
  };

  return (
    <TextField
      fullWidth
      label={label}
      value={value}
      slotProps={{
        input: {
          readOnly: true,
          sx: { fontFamily: "monospace", fontSize: 13 },
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                size="small"
                aria-label={`Copy ${label}`}
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon fontSize="small" color="success" />
                ) : (
                  <ContentCopyIcon
                    fontSize="small"
                    color={failed ? "error" : "inherit"}
                  />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

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

  const filteredParticipants = useMemo(
    () =>
      participants.filter((p) =>
        p.name
          .toLowerCase()
          .includes(debouncedParticipantSearchQuery.toLowerCase()),
      ),
    [participants, debouncedParticipantSearchQuery],
  );

  const filteredAttended = useMemo(
    () =>
      filteredParticipants
        .filter((a) => a.checkedInAt != null)
        .sort((a, b) =>
          (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""),
        ),
    [filteredParticipants],
  );

  const filteredPending = useMemo(
    () =>
      filteredParticipants
        .filter((a) => a.checkedInAt == null && a.activated == null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredParticipants],
  );

  const filteredNotAttended = useMemo(
    () =>
      filteredParticipants
        .filter(
          (a) =>
            a.checkedInAt == null &&
            a.isTicketReady &&
            a.isTicketDelivered &&
            a.activated === true,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredParticipants],
  );

  const filteredTicketUndelivered = useMemo(
    () =>
      filteredParticipants
        .filter(
          (a) =>
            a.checkedInAt == null && !a.isTicketReady && a.activated === true,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredParticipants],
  );

  const filteredNotDelivered = useMemo(
    () =>
      filteredParticipants
        .filter(
          (a) =>
            a.checkedInAt == null &&
            a.isTicketReady &&
            !a.isTicketDelivered &&
            a.activated === true,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredParticipants],
  );

  const filteredDeactivated = useMemo(
    () =>
      filteredParticipants
        .filter((a) => a.checkedInAt == null && a.activated === false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredParticipants],
  );

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
              icon={<CalendarTodayIcon sx={{ pl: "6px" }} />}
              label={event.date}
              onClick={() => setDateDialogOpen(true)}
              variant="outlined"
            />
            <Chip
              icon={<GroupIcon sx={{ pl: "6px" }} />}
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

      <Dialog
        open={pairDialogOpen}
        onClose={handleClosePair}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Pair companion device</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography>
              On the kiosk or phone, open a browser and go to
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, wordBreak: "break-all" }}
            >
              {window.location.origin}
            </Typography>
            <Typography>
              Open <strong>Companion devices</strong>, tap
              <strong> Pair a new device</strong>, then scan the QR code below
              with the camera. You&apos;ll choose whether the device is a kiosk
              or a scanner.
            </Typography>
          </Stack>
          {companionToken && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
              <QRCodeSVG
                value={`${window.location.origin}/companion/join#v1.${eventId}.${companionToken}`}
                size={220}
              />
            </Box>
          )}
          <Divider sx={{ my: 2 }}>Can&apos;t scan the QR code?</Divider>
          <Stack spacing={1.5}>
            <CopyableField label="Event ID" value={eventId} />
            {companionToken && (
              <CopyableField label="Pairing token" value={companionToken} />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Or enter these values on the device's pairing screen. Rotate the
            pairing token to revoke all paired devices.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRotateToken} color="error">
            Rotate pairing token
          </Button>
          <Button onClick={handleClosePair}>Close</Button>
        </DialogActions>
      </Dialog>

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
