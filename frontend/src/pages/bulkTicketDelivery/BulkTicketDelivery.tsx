import {useEffect, useMemo, useState} from 'react'
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import SendIcon from '@mui/icons-material/Send'
import {useLocation, useNavigate} from '@tanstack/react-router'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {apiUrl, useApi} from '../../api'
import {useAuth} from '../../providers/useAuth'
import type {AttendeeItem} from '../eventDetail/useEventDetail'
import type {EventItem} from '../eventsList/useEvents'

export default function BulkTicketDelivery() {
    const location = useLocation()
    const eventId = location.pathname.split('/').filter(Boolean)[1]
    const navigate = useNavigate()
    const api = useApi()
    const queryClient = useQueryClient()
    const {username, password} = useAuth()

    const eventQuery = useQuery<EventItem>({
        queryKey: ['event', eventId],
        queryFn: () => api.get(`/api/events/${eventId}`),
    })

    const attendeesQuery = useQuery<AttendeeItem[]>({
        queryKey: ['attendees', eventId],
        queryFn: () => api.get(`/api/events/${eventId}/attendees`),
    })

    const undeliveredReady = useMemo(
        () => (attendeesQuery.data ?? []).filter(a => !a.isTicketDelivered && a.isTicketReady),
        [attendeesQuery.data],
    )

    const [previewIndex, setPreviewIndex] = useState(0)
    const [previewResult, setPreviewResult] = useState<{attendeeId: string, html: string | null} | null>(null)

    const clampedIndex = Math.min(previewIndex, Math.max(0, undeliveredReady.length - 1))
    const currentAttendee = undeliveredReady[clampedIndex] ?? null

    useEffect(() => {
        if (!currentAttendee) return
        let cancelled = false
        const headers: Record<string, string> = {}
        if (username && password) {
            headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
        }
        const attendeeId = currentAttendee.id
        fetch(`${apiUrl}/api/events/${eventId}/attendees/${attendeeId}/email/preview`, {headers})
            .then(res => {
                if (cancelled) return
                if (!res.ok) throw new Error('Failed')
                return res.text()
            })
            .then(html => {
                if (!cancelled) {
                    setPreviewResult({attendeeId, html: html ?? null})
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPreviewResult({attendeeId, html: null})
                }
            })
        return () => { cancelled = true }
    }, [currentAttendee, eventId, username, password])

    const previewLoading = !!currentAttendee && (previewResult?.attendeeId !== currentAttendee.id)
    const displayHtml = (currentAttendee && previewResult?.attendeeId === currentAttendee.id && previewResult.html)
        ? previewResult.html
        : null

    const sendMutation = useMutation({
        mutationFn: async () => {
            const headers: Record<string, string> = {'Content-Type': 'application/json'}
            if (username && password) {
                headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
            }
            const body = undeliveredReady.map(a => a.id)
            const res = await fetch(`${apiUrl}/api/events/${eventId}/emails`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error(`${res.status}`)
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['attendees', eventId]})
            navigate({to: '/events/$eventId', params: {eventId}})
        },
    })

    const handlePrev = () => setPreviewIndex(i => Math.max(0, i - 1))
    const handleNext = () => setPreviewIndex(i => Math.min(undeliveredReady.length - 1, i + 1))

    const goBack = () => navigate({to: '/events/$eventId', params: {eventId}})

    if (eventQuery.isLoading || attendeesQuery.isLoading) {
        return <LinearProgress/>
    }

    const event = eventQuery.data

    return (
        <Box sx={{display: 'flex', height: 'calc(100vh - 64px)'}}>
            <Box sx={{flex: 1, overflow: 'auto', p: 4}}>
                <Stack spacing={3}>
                    <Typography variant="h4">{event?.name}</Typography>
                    <Typography variant="h6" color="text.secondary">
                        Bulk ticket delivery to undelivered guests
                    </Typography>
                    <Typography variant="body1">
                        Confirm sending ticket email to the following guests
                    </Typography>

                    {undeliveredReady.length > 0 ? (
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email address</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {undeliveredReady.map(a => (
                                        <TableRow key={a.id}>
                                            <TableCell>{a.title} {a.name}</TableCell>
                                            <TableCell>{a.email}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography color="text.secondary">No undelivered guests with ready tickets.</Typography>
                    )}

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="contained"
                            startIcon={<SendIcon/>}
                            onClick={() => sendMutation.mutate()}
                            loading={sendMutation.isPending}
                            disabled={undeliveredReady.length === 0}
                        >
                            Send to all
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={goBack}
                            disabled={sendMutation.isPending}
                        >
                            Cancel
                        </Button>
                    </Stack>
                </Stack>
            </Box>

            <Box sx={{flex: 1, bgcolor: 'grey.100', p: 3, display: 'flex', flexDirection: 'column', minHeight: 0}}>
                <Box sx={{
                    maxWidth: 700, width: '100%', mx: 'auto',
                    flex: 1, minHeight: 0,
                    display: 'flex', flexDirection: 'column',
                    gap: 2,
                }}>
                    <Paper elevation={2} sx={{p: 2, flexShrink: 0}}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{mb: 1.5, textAlign: 'center'}}>
                            Preview email
                        </Typography>
                        <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'center'}} spacing={1}>
                            <IconButton
                                onClick={handlePrev}
                                disabled={clampedIndex <= 0}
                                size="small"
                            >
                                <NavigateBeforeIcon/>
                            </IconButton>
                            <Typography variant="body1" sx={{minWidth: 180, textAlign: 'center'}}>
                                {currentAttendee ? `${currentAttendee.title} ${currentAttendee.name}` : '—'}
                            </Typography>
                            <IconButton
                                onClick={handleNext}
                                disabled={clampedIndex >= undeliveredReady.length - 1}
                                size="small"
                            >
                                <NavigateNextIcon/>
                            </IconButton>
                        </Stack>
                    </Paper>

                    <Paper elevation={2} sx={{overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
                        {currentAttendee ? (
                            <>
                                <Box sx={{p: 2, flexShrink: 0}}>
                                    <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                                        <Typography variant="body2" color="text.secondary">To:</Typography>
                                        <Chip icon={<EmailIcon/>} label={currentAttendee.email} size="small" variant="outlined"/>
                                    </Stack>
                                </Box>
                                <Divider/>
                                <Box sx={{p: 2, flexShrink: 0}}>
                                    <Typography variant="body2" color="text.secondary">
                                        Subject: [Ticket] {event?.name}
                                    </Typography>
                                </Box>
                                <Divider/>
                                <Box sx={{p: 2, flex: 1, overflow: 'auto', minHeight: 0}}>
                                    {previewLoading && (
                                        <Box sx={{display: 'flex', justifyContent: 'center', py: 4}}>
                                            <CircularProgress size={32}/>
                                        </Box>
                                    )}
                                    {!previewLoading && displayHtml && (
                                        <Box dangerouslySetInnerHTML={{__html: displayHtml}}/>
                                    )}
                                    {!previewLoading && !displayHtml && (
                                        <Typography color="text.secondary">Failed to load preview.</Typography>
                                    )}
                                </Box>
                            </>
                        ) : (
                            <Box sx={{p: 2, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                <Typography color="text.secondary">Select an attendee to preview</Typography>
                            </Box>
                        )}
                    </Paper>
                </Box>
            </Box>
        </Box>
    )
}
