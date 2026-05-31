import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EditIcon from "@mui/icons-material/Edit";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  useMatches,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { useEventDetail } from "./useEventDetail";
import AddAttendeesSpeedDial from "./components/AddAttendeesSpeedDial";
import ActionsSection from "./components/ActionsSection";
import AttendeeDetailsDialog from "./components/AttendeeDetailsDialog";
import AttendanceSummary from "./components/AttendanceSummary";
import CheckinNotificationDialog from "./components/CheckinNotificationDialog";
import DateDialog from "./components/DateDialog";
import ImportResultDialog from "./components/ImportResultDialog";
import ModeDialog from "./components/ModeDialog";
import ModifyEventsDialog from "./components/ModifyEventsDialog";
import AttendeeGrid from "@/components/AttendeeGrid";
import { useApi } from "../../api";
import { useEventStream } from "../../hooks/useEventStream";

export default function EventDetail() {
  const { eventId } = useParams({ from: "/app-shell/events/$eventId" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const api = useApi();
  const { enqueueSnackbar } = useSnackbar();
  const {
    event,
    isEventLoading,
    attendees,
    attended,
    notAttended,
    ticketUndelivered,
    isAttendeesLoading,
    updateEvent,
    isUpdating,
    updateMode,
    isUpdatingMode,
    deleteEvent,
    isDeleting,
  } = useEventDetail(eventId);

  const {
    createAttendeeProgress,
    sendEmailProgress,
    generateTicketQrProgress,
    resultDialog,
    dismissResultDialog,
    attendanceDialog,
    dismissAttendanceDialog,
  } = useEventStream(eventId, queryClient);

  const matches = useMatches();
  const isChildRouteActive = matches.some(
    (m) =>
      m.pathname?.includes("/addAttendeesBySpreadsheet") ||
      m.pathname?.includes("/addAttendeesManually"),
  );

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(
    null,
  );

  const selectedAttendee = selectedAttendeeId
    ? (attendees.find((a) => a.id === selectedAttendeeId) ?? null)
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
        navigate({ to: "/events" });
      },
    });
  };

  const totalCount = attendees.length;
  const attendedCount = attended.length;
  const undeliveredReadyCount = attendees.filter(
    (a) => a.isTicketReady && !a.isTicketDelivered,
  ).length;
  const notReadyAttendees = attendees.filter((a) => !a.isTicketReady);
  const notReadyCount = notReadyAttendees.length;
  const notReadyIds = notReadyAttendees.map((a) => a.id);

  const hasActionsContent =
    undeliveredReadyCount > 0 ||
    notReadyCount > 0 ||
    !!createAttendeeProgress?.inProgress ||
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
      <>
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
            key={attendanceDialog.attendeeId}
            dialog={attendanceDialog}
            onDismiss={dismissAttendanceDialog}
          />
        )}
      </>
    );
  }

  if (isEventLoading || !event || !eventData) {
    return <LinearProgress />;
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ p: 2 }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <Typography variant="h4">{event.name}</Typography>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={async () => {
              try {
                const status = await api.get<{ connected: boolean }>(
                  `/api/events/${eventId}/checkInBooth/status`,
                );
                if (status.connected) {
                  enqueueSnackbar("Booth is already open", {
                    variant: "warning",
                  });
                  return;
                }
              } catch {
                // fall through to open booth anyway
              }
              const url = `/events/${eventId}/checkInBooth`;
              const popup = window.open(
                url,
                "checkinBooth",
                "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
              );
              if (!popup) {
                navigate({
                  to: "/events/$eventId/checkInBooth",
                  params: { eventId },
                });
              }
            }}
          >
            Check-in Booth
          </Button>
        </Stack>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mt: 1, mb: 2 }}
        >
          {event.description || "No description."}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
          <Chip
            icon={<CalendarTodayIcon />}
            label={event.date}
            onClick={() => setDateDialogOpen(true)}
            variant="outlined"
          />
        </Stack>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "flex-end" }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Attendance mode:
            </Typography>
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
          </Stack>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setSettingsDialogOpen(true)}
          >
            Modify Events
          </Button>
        </Stack>
      </Card>

      <AttendanceSummary
        totalCount={totalCount}
        attendedCount={attendedCount}
      />

      {hasActionsContent && (
        <ActionsSection
          eventId={eventId}
          undeliveredReadyCount={undeliveredReadyCount}
          notReadyCount={notReadyCount}
          notReadyIds={notReadyIds}
          createAttendeeProgress={createAttendeeProgress}
          sendEmailProgress={sendEmailProgress}
          generateTicketQrProgress={generateTicketQrProgress}
        />
      )}

      {isAttendeesLoading && <LinearProgress />}

      {attended.length > 0 && (
        <AttendeeGrid
          attendees={attended}
          title="Attended"
          onClick={(id) => setSelectedAttendeeId(id)}
        />
      )}

      {notAttended.length > 0 && (
        <AttendeeGrid
          attendees={notAttended}
          title="Not Attended"
          onClick={(id) => setSelectedAttendeeId(id)}
        />
      )}

      {ticketUndelivered.length > 0 && (
        <AttendeeGrid
          attendees={ticketUndelivered}
          title="Ticket Undelivered"
          onClick={(id) => setSelectedAttendeeId(id)}
        />
      )}

      {attendees.length === 0 && !isAttendeesLoading && (
        <Typography color="text.secondary">No attendees yet.</Typography>
      )}

      <AddAttendeesSpeedDial eventId={eventId} />

      {resultDialog && (
        <ImportResultDialog
          eventId={eventId}
          resultId={resultDialog.resultId}
          onClose={dismissResultDialog}
        />
      )}

      {attendanceDialog && (
        <CheckinNotificationDialog
          key={attendanceDialog.attendeeId}
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

      {selectedAttendee && (
        <AttendeeDetailsDialog
          open
          attendee={selectedAttendee}
          eventId={eventId}
          eventName={event.name}
          onClose={() => setSelectedAttendeeId(null)}
        />
      )}
    </Stack>
  );
}
