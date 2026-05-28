import {useCallback, useRef, useState} from 'react'
import type {SelectChangeEvent} from '@mui/material/Select'
import {
    Alert,
    Box,
    Button,
    Chip,
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
    Typography,
} from '@mui/material'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {useLocation, useNavigate} from '@tanstack/react-router'
import {useApi} from '../../api'
import {useAuth} from '../../providers/useAuth'

const ATTENDEE_FIELDS = ['Ignore', 'Title', 'Name', 'Phone', 'Email'] as const
type AttendeeField = (typeof ATTENDEE_FIELDS)[number]

interface SheetPreview {
    columns: string[]
    heads: string[][]
}

interface ExcelPreviewResponse {
    taskId: string
    expireIn: string
    sheetNames: string[]
    sheets: Record<string, SheetPreview>
}

interface RowMapping {
    titleColumn?: string | null
    nameColumn?: string | null
    rawPhoneColumn?: string | null
    emailColumn?: string | null
}

interface ExcelImportRequest {
    taskId: string
    sheetName: string
    rowMapping: RowMapping
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
        attendee: {title: string; name: string; email: string; rawPhone: string}
        reason: string
    }>
}

export default function AddAttendeesBySpreadsheet() {
    const location = useLocation()
    const eventId = location.pathname.split('/').filter(Boolean)[1]
    const navigate = useNavigate()
    const api = useApi()
    const queryClient = useQueryClient()
    const {username, password} = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const eventQuery = useQuery<{name: string}>({
        queryKey: ['event', eventId],
        queryFn: () => api.get(`/api/events/${eventId}`),
    })
    const eventName = eventQuery.data?.name ?? '...'

    const [activeStep, setActiveStep] = useState(0)
    const [preview, setPreview] = useState<ExcelPreviewResponse | null>(null)
    const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
    const [columnMapping, setColumnMapping] = useState<Record<string, AttendeeField>>({})
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<BulkCreateResult | null>(null)
    const [importError, setImportError] = useState<string | null>(null)

    const importMutation = useMutation({
        mutationFn: (payload: ExcelImportRequest) =>
            api.post<BulkCreateResult>(`/api/events/${eventId}/excelImport`, payload),
        onSuccess: (data) => {
            setResult(data)
            setImportError(null)
            setActiveStep(3)
            queryClient.invalidateQueries({queryKey: ['attendees', eventId]})
        },
        onError: () => {
            setImportError('Failed to import attendees. Please try again.')
        },
    })

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setUploadError(null)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch(`/api/events/${eventId}/excelPreview`, {
                method: 'POST',
                headers: username && password ? {Authorization: `Basic ${btoa(`${username}:${password}`)}`} : {},
                body: formData,
            })
            if (!res.ok) throw new Error(`${res.status}`)
            const data = (await res.json()) as ExcelPreviewResponse
            setPreview(data)
            if (data.sheetNames.length === 1) {
                setSelectedSheet(data.sheetNames[0])
                setActiveStep(2)
            } else {
                setActiveStep(1)
            }
        } catch {
            setUploadError('Failed to upload or parse the file. Ensure it is a valid Excel or CSV file.')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }, [eventId, username, password])

    const handleButtonClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const handleSheetSelect = (sheetName: string) => {
        setSelectedSheet(sheetName)
        setActiveStep(2)
    }

    const handleColumnMappingChange = (columnName: string, field: AttendeeField) => {
        setColumnMapping((prev) => {
            const next = {...prev}
            if (field !== 'Ignore') {
                Object.keys(next).forEach((col) => {
                    if (next[col] === field && col !== columnName) {
                        next[col] = 'Ignore'
                    }
                })
            }
            next[columnName] = field
            return next
        })
    }

    const getMappingAssignment = (field: AttendeeField): string | null => {
        if (field === 'Ignore') return null
        return Object.entries(columnMapping).find(([, f]) => f === field)?.[0] ?? null
    }

    const handleImport = () => {
        if (!preview || !selectedSheet) return
        setImportError(null)
        const rowMapping: RowMapping = {}
        const titleCol = getMappingAssignment('Title')
        const nameCol = getMappingAssignment('Name')
        const phoneCol = getMappingAssignment('Phone')
        const emailCol = getMappingAssignment('Email')
        if (titleCol) rowMapping.titleColumn = titleCol
        if (nameCol) rowMapping.nameColumn = nameCol
        if (phoneCol) rowMapping.rawPhoneColumn = phoneCol
        if (emailCol) rowMapping.emailColumn = emailCol
        importMutation.mutate({taskId: preview.taskId, sheetName: selectedSheet, rowMapping})
    }

    const isImportDisabled = !getMappingAssignment('Name')

    if (activeStep === 3 && result) {
        return (
            <Stack spacing={3}>
                <Stepper activeStep={3}>
                    <Step><StepLabel>Upload file</StepLabel></Step>
                    <Step><StepLabel>{preview && preview.sheetNames.length > 1 ? 'Select sheet' : 'Review'}</StepLabel></Step>
                    <Step><StepLabel>Map columns</StepLabel></Step>
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
            <Stepper activeStep={activeStep}>
                <Step><StepLabel>Upload file</StepLabel></Step>
                <Step><StepLabel>{preview && preview.sheetNames.length > 1 ? 'Select sheet' : 'Review'}</StepLabel></Step>
                <Step><StepLabel>Map columns</StepLabel></Step>
                <Step><StepLabel>Completed</StepLabel></Step>
            </Stepper>

            <Typography variant="h5">Add Attendees from Spreadsheet to {eventName}</Typography>

            {uploadError && <Alert severity="error" onClose={() => setUploadError(null)}>{uploadError}</Alert>}
            {importError && <Alert severity="error" onClose={() => setImportError(null)}>{importError}</Alert>}

            {activeStep === 0 && (
                <Stack spacing={2} alignItems="center">
                    <Paper
                        variant="outlined"
                        sx={{
                            p: 6,
                            textAlign: 'center',
                            width: '100%',
                            maxWidth: 400,
                            borderStyle: 'dashed',
                            cursor: 'pointer',
                            '&:hover': {borderColor: 'primary.main', bgcolor: 'action.hover'},
                        }}
                    >
                        <Typography variant="body1" sx={{mb: 1}}>Drag and drop or click to upload</Typography>
                        <Button variant="contained" loading={uploading} onClick={handleButtonClick}>
                            Select File
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{mt: 1, display: 'block'}}>
                            Supports .xlsx, .xls, .csv
                        </Typography>
                    </Paper>
                </Stack>
            )}

            {activeStep === 1 && preview && preview.sheetNames.length > 1 && (
                <Stack spacing={2}>
                    <Typography variant="subtitle1">Select a sheet to import:</Typography>
                    {preview.sheetNames.map((name) => {
                        const sheet = preview.sheets[name]
                        return (
                            <Paper
                                key={name}
                                variant="outlined"
                                sx={{p: 2, cursor: 'pointer', '&:hover': {borderColor: 'primary.main', bgcolor: 'action.hover'}}}
                                onClick={() => handleSheetSelect(name)}
                            >
                                <Typography variant="subtitle2" sx={{mb: 1}}>{name}</Typography>
                                {sheet.columns.length > 0 ? (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    {sheet.columns.map((col) => (
                                                        <TableCell key={col} sx={{fontWeight: 600}}>{col}</TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {sheet.heads.map((row, ri) => (
                                                    <TableRow key={ri}>
                                                        {row.map((cell, ci) => (
                                                            <TableCell key={ci}>{cell}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                ) : (
                                    <Typography variant="body2" color="text.secondary">(empty sheet)</Typography>
                                )}
                            </Paper>
                        )
                    })}
                </Stack>
            )}

            {activeStep === 2 && preview && selectedSheet && (
                <Stack spacing={2}>
                    <Typography variant="subtitle1">
                        Sheet: <strong>{selectedSheet}</strong> — map each column to an attendee field:
                    </Typography>
                    {preview.sheets[selectedSheet].columns.length > 0 ? (
                        <>
                            <TableContainer component={Paper} variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            {preview.sheets[selectedSheet].columns.map((col) => {
                                                const assigned = columnMapping[col] || 'Ignore'
                                                const usedFields = new Set(
                                                    Object.values(columnMapping).filter((f) => f !== 'Ignore'),
                                                )
                                                return (
                                                    <TableCell key={col} sx={{verticalAlign: 'top', pb: 0}}>
                                                        <Select
                                                            value={assigned}
                                                            onChange={(ev: SelectChangeEvent<AttendeeField>) =>
                                                                handleColumnMappingChange(col, ev.target.value as AttendeeField)
                                                            }
                                                            size="small"
                                                            sx={{minWidth: 100, mb: 0.5}}
                                                        >
                                                            {ATTENDEE_FIELDS.map((f) => (
                                                                <MenuItem
                                                                    key={f}
                                                                    value={f}
                                                                    disabled={f !== 'Ignore' && f !== assigned && usedFields.has(f)}
                                                                >
                                                                    {f}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                        <Typography variant="caption" display="block" sx={{fontWeight: 600}}>
                                                            {col}
                                                        </Typography>
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {preview.sheets[selectedSheet].heads.map((row, ri) => (
                                            <TableRow key={ri}>
                                                {row.map((cell, ci) => (
                                                    <TableCell key={ci}>{cell}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Box>
                                <Button
                                    variant="contained"
                                    onClick={handleImport}
                                    loading={importMutation.isPending}
                                    disabled={isImportDisabled}
                                >
                                    Import Attendees
                                </Button>
                            </Box>
                        </>
                    ) : (
                        <Typography variant="body2" color="text.secondary">This sheet is empty.</Typography>
                    )}
                </Stack>
            )}
        </Stack>
    )
}
