import {useState} from 'react'
import {
    Button,
    Card,
    Chip,
    Collapse,
    Grid,
    LinearProgress,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import EditIcon from '@mui/icons-material/Edit'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import {useLocation, useNavigate} from '@tanstack/react-router'
import {useEventDetail} from './useEventDetail'
import EmailIcon from '@mui/icons-material/Email'
import AddAttendeesSpeedDial from './components/AddAttendeesSpeedDial'
import AttendeeCard from './components/AttendeeCard'
import AttendeeDetailsDialog from './components/AttendeeDetailsDialog'
import AttendanceSummary from './components/AttendanceSummary'
import DateDialog from './components/DateDialog'
import ModeDialog from './components/ModeDialog'
import ModifyEventsDialog from './components/ModifyEventsDialog'

export default function EventDetail() {
    const location = useLocation()
    const eventId = location.pathname.split('/').filter(Boolean)[1]
    const navigate = useNavigate()
    const {
        event,
        isEventLoading,
        attendees,
        attended,
        notAttended,
        isAttendeesLoading,
        updateEvent,
        isUpdating,
        updateMode,
        isUpdatingMode,
        deleteEvent,
        isDeleting,
    } = useEventDetail(eventId)

    const [dateDialogOpen, setDateDialogOpen] = useState(false)
    const [modeDialogOpen, setModeDialogOpen] = useState(false)
    const [pendingMode, setPendingMode] = useState<string | null>(null)
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
    const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null)

    const selectedAttendee = selectedAttendeeId
        ? attendees.find((a) => a.id === selectedAttendeeId) ?? null
        : null

    const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: string | null) => {
        if (newMode && newMode !== event?.mode) {
            setPendingMode(newMode)
            setModeDialogOpen(true)
        }
    }

    const handleModeConfirm = () => {
        if (pendingMode) {
            updateMode(pendingMode, {
                onSuccess: () => setModeDialogOpen(false),
            })
        }
    }

    const handleDateSave = (date: string) => {
        if (!event) return
        updateEvent({
            name: event.name,
            description: event.description,
            date,
        })
        setDateDialogOpen(false)
    }

    const handleSettingsSave = (data: { name: string; description: string; date: string; hasBoothImage: boolean }) => {
        updateEvent({name: data.name, description: data.description, date: data.date})
    }

    const handleDeleteEvent = () => {
        deleteEvent(undefined, {
            onSuccess: () => {
                navigate({to: '/events'})
            },
        })
    }

    const totalCount = attendees.length
    const attendedCount = attended.length
    const undeliveredReadyCount = attendees.filter(a => !a.isTicketDelivered && a.isTicketReady).length

    if (isEventLoading || !event) {
        return <LinearProgress/>
    }

    return (
        <Stack spacing={2}>
            <Card sx={{p: 2}}>

                <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <Typography variant="h4">
                        {event.name}
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<QrCodeScannerIcon/>}
                        onClick={() => {
                            const url = `/events/${eventId}/scanner`
                            const popup = window.open(
                                url,
                                'checkinBooth',
                                'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no'
                            )
                            if (!popup) {
                                navigate({to: '/events/$eventId/scanner', params: {eventId}})
                            }
                        }}
                    >
                        Check-in Booth
                    </Button>
                </Stack>
                <Typography variant="body1" color="text.secondary" sx={{mt: 1, mb: 2}}>
                    {event.description || 'No description.'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{mb: 2, alignItems: 'center'}}>
                    <Chip
                        icon={<CalendarTodayIcon/>}
                        label={event.date}
                        onClick={() => setDateDialogOpen(true)}
                        variant="outlined"
                    />
                </Stack>
                <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'flex-end'}}>
                    <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
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
                        startIcon={<EditIcon/>}
                        onClick={() => setSettingsDialogOpen(true)}
                    >
                        Modify Events
                    </Button>
                </Stack>
            </Card>

            <AttendanceSummary totalCount={totalCount} attendedCount={attendedCount}/>

            <Collapse in={undeliveredReadyCount > 0}>
                <Card sx={{p: 2}}>
                    <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} sx={{alignItems: 'center'}}>
                            <EmailIcon color="primary"/>
                            <Typography variant="h6">Deliver tickets to all attendees in one click</Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {undeliveredReadyCount} attendee(s) haven't received their ticket yet. Click here to send
                            tickets to all undelivered attendees.
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => navigate({to: '/events/$eventId/bulkTicketDelivery', params: {eventId}})}
                        >
                            Bulk ticket delivery to undelivered attendees
                        </Button>
                    </Stack>
                </Card>
            </Collapse>

            {isAttendeesLoading && <LinearProgress/>}

            {attended.length > 0 && (
                <>
                    <Typography variant="subtitle1">Attended</Typography>
                    <Grid container spacing={2}>
                        {attended.map((a) => (
                            <Grid key={a.id} size={{xs: 12, sm: 6, md: 4}}>
                                <AttendeeCard attendee={a} onClick={() => setSelectedAttendeeId(a.id)}/>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}

            {notAttended.length > 0 && (
                <>
                    <Typography variant="subtitle1">Not Attended</Typography>
                    <Grid container spacing={2}>
                        {notAttended.map((a) => (
                            <Grid key={a.id} size={{xs: 12, sm: 6, md: 4}}>
                                <AttendeeCard attendee={a} onClick={() => setSelectedAttendeeId(a.id)}/>
                            </Grid>
                        ))}
                    </Grid>
                </>
            )}

            {attendees.length === 0 && !isAttendeesLoading && (
                <Typography color="text.secondary">No attendees yet.</Typography>
            )}

            <AddAttendeesSpeedDial eventId={eventId}/>

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
                event={{
                    name: event.name,
                    description: event.description,
                    date: event.date,
                    hasBoothImage: event.hasBoothImage
                }}
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
    )
}
