import {useState} from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Stack,
    Step,
    StepLabel,
    Stepper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useLocation, useNavigate} from '@tanstack/react-router'
import {useApi} from '../../api'

const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.']

interface AttendeeInput {
    key: number
    title: string
    name: string
    email: string
    rawPhone: string
}

interface BulkCreateResult {
    created: Array<{
        title: string
        name: string
        email: string
        isTicketDelivered: boolean
    }>
    skipped: Array<{
        title: string
        name: string
        email: string
        rawPhone: string
    }>
    errors: Array<{
        attendee: { title: string; name: string; email: string; rawPhone: string }
        reason: string
    }>
}

let nextKey = 0

function newRow(): AttendeeInput {
    return {key: ++nextKey, title: 'Mr.', name: '', email: '', rawPhone: ''}
}

export default function AddAttendeesManually() {
    const location = useLocation()
    const eventId = location.pathname.split('/').filter(Boolean)[1]
    const navigate = useNavigate()
    const api = useApi()
    const queryClient = useQueryClient()

    const eventQuery = useQuery<{ name: string }>({
        queryKey: ['event', eventId],
        queryFn: () => api.get(`/api/events/${eventId}`),
    })
    const eventName = eventQuery.data?.name ?? '...'

    const [activeStep, setActiveStep] = useState(0)
    const [rows, setRows] = useState<AttendeeInput[]>([newRow()])
    const [result, setResult] = useState<BulkCreateResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const mutation = useMutation({
        mutationFn: (payload: Array<{ title: string; name: string; email: string; rawPhone: string }>) =>
            api.post<BulkCreateResult>(`/api/events/${eventId}/attendees`, payload),
        onSuccess: (data) => {
            setResult(data)
            setError(null)
            setActiveStep(1)
            queryClient.invalidateQueries({queryKey: ['attendees', eventId]})
        },
        onError: () => {
            setError('Failed to submit attendees. Please try again.')
        },
    })

    const updateRow = (key: number, field: keyof AttendeeInput, value: string) => {
        setRows((prev) =>
            prev.map((r) => (r.key === key ? {...r, [field]: value} : r)),
        )
    }

    const deleteRow = (key: number) => {
        setRows((prev) => {
            const next = prev.filter((r) => r.key !== key)
            return next.length === 0 ? [newRow()] : next
        })
    }

    const addRow = () => {
        setRows((prev) => [...prev, newRow()])
    }

    const handleSubmit = () => {
        setError(null)
        const payload = rows.map(({title, name, email, rawPhone}) => ({
            title,
            name,
            email,
            rawPhone,
        }))
        mutation.mutate(payload)
    }

    const hasAnyField = rows.some(
        (r) => r.title || r.name || r.email || r.rawPhone,
    )

    if (activeStep === 1 && result) {
        return (
            <Stack spacing={3}>
                <Typography variant="h4">{eventName}</Typography>
                <Typography variant="h5">Add Attendees Manually</Typography>
                <Stepper activeStep={1}>
                    <Step><StepLabel>Input attendee details</StepLabel></Step>
                    <Step><StepLabel>Completed</StepLabel></Step>
                </Stepper>
                <Typography variant="h5">Import Result</Typography>

                {result.created.length > 0 && (
                    <Paper variant="outlined" sx={{p: 2}}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" color="success.main">
                                <Chip label={result.created.length} color="success" size="small" sx={{mr: 1}}/>
                                Created
                            </Typography>
                            {result.created.map((a, i) => (
                                <Typography key={i} variant="body2" color="text.secondary">
                                    {a.title} {a.name} &lt;{a.email}&gt;
                                    {a.isTicketDelivered ? ' — ticket delivered' : ''}
                                </Typography>
                            ))}
                        </Stack>
                    </Paper>
                )}

                {result.skipped.length > 0 && (
                    <Paper variant="outlined" sx={{p: 2}}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" color="warning.main">
                                <Chip label={result.skipped.length} color="warning" size="small" sx={{mr: 1}}/>
                                Skipped (duplicate)
                            </Typography>
                            {result.skipped.map((a, i) => (
                                <Typography key={i} variant="body2" color="text.secondary">
                                    {a.title} {a.name} &lt;{a.email}&gt;
                                </Typography>
                            ))}
                        </Stack>
                    </Paper>
                )}

                {result.errors.length > 0 && (
                    <Paper variant="outlined" sx={{p: 2}}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" color="error.main">
                                <Chip label={result.errors.length} color="error" size="small" sx={{mr: 1}}/>
                                Errors
                            </Typography>
                            {result.errors.map((e, i) => (
                                <Typography key={i} variant="body2" color="text.secondary">
                                    {e.attendee.title} {e.attendee.name}: {e.reason}
                                </Typography>
                            ))}
                        </Stack>
                    </Paper>
                )}

                {result.created.length === 0 && result.skipped.length === 0 && result.errors.length === 0 && (
                    <Typography color="text.secondary">No attendees were processed.</Typography>
                )}

                <Box>
                    <Button variant="contained" onClick={() => navigate({to: '/events/$eventId', params: {eventId}})}>
                        Return to Event
                    </Button>
                </Box>
            </Stack>
        )
    }

    return (
        <Stack spacing={3}>
            <Typography variant="h4">{eventName}</Typography>

            <Typography variant="h5">Add Attendees Manually</Typography>

            <Stepper activeStep={0}>
                <Step><StepLabel>Input attendee details</StepLabel></Step>
                <Step><StepLabel>Completed</StepLabel></Step>
            </Stepper>

            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{width: 100}}>Title</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell sx={{width: 48}}/>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.key}>
                                <TableCell>
                                    <Select
                                        value={row.title}
                                        onChange={(e) => updateRow(row.key, 'title', e.target.value)}
                                        size="small"
                                        fullWidth
                                    >
                                        {TITLE_OPTIONS.map((t) => (
                                            <MenuItem key={t} value={t}>{t}</MenuItem>
                                        ))}
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        value={row.name}
                                        onChange={(e) => updateRow(row.key, 'name', e.target.value)}
                                        size="small"
                                        fullWidth
                                        placeholder="Name"
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        value={row.email}
                                        onChange={(e) => updateRow(row.key, 'email', e.target.value)}
                                        size="small"
                                        fullWidth
                                        placeholder="Email"
                                        type="email"
                                    />
                                </TableCell>
                                <TableCell>
                                    <TextField
                                        value={row.rawPhone}
                                        onChange={(e) => updateRow(row.key, 'rawPhone', e.target.value)}
                                        size="small"
                                        fullWidth
                                        placeholder="Phone"
                                        type="tel"
                                    />
                                </TableCell>
                                <TableCell>
                                    <IconButton size="small" onClick={() => deleteRow(row.key)}>
                                        <DeleteIcon fontSize="small"/>
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button startIcon={<AddIcon/>} onClick={addRow} variant="outlined" size="small"
                    sx={{alignSelf: 'flex-start'}}>
                Add Row
            </Button>

            <Box>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    loading={mutation.isPending}
                    disabled={!hasAnyField}
                >
                    Submit
                </Button>
            </Box>
        </Stack>
    )
}
