import {useState, useEffect, useCallback} from 'react'
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid'
import BackspaceIcon from '@mui/icons-material/Backspace'
import CheckIcon from '@mui/icons-material/Check'
import useSound from 'use-sound'
import PhoneDialPad from './PhoneDialPad'
import {useApi} from '../../../api'
import successSound from '../../../assets/soundEffects/checkin_success.aac'
import failSound from '../../../assets/soundEffects/checkin_fail.aac'

interface CheckinSuccessDetail {
    title: string
    name: string
}

interface CheckinErrorDetail {
    reason: string
}

interface CheckinResponse {
    success: boolean
    detail: CheckinSuccessDetail | CheckinErrorDetail
}

interface Props {
    open: boolean
    eventId: string
    onClose: () => void
}

type Phase = 'input' | 'loading' | 'success' | 'error'

export default function CheckinByPhoneDialog({open, eventId, onClose}: Props) {
    const api = useApi()
    const [countryCodes, setCountryCodes] = useState<string[]>([])
    const [selectedCountryCode, setSelectedCountryCode] = useState('')
    const [phoneNo, setPhoneNo] = useState('')
    const [phase, setPhase] = useState<Phase>('input')
    const [result, setResult] = useState<CheckinResponse | null>(null)
    const [errorMessage, setErrorMessage] = useState('')
    const [playSuccess] = useSound(successSound, {volume: 0.5})
    const [playFail] = useSound(failSound, {volume: 0.5})

    useEffect(() => {
        api.get<string[]>(`/api/events/${eventId}/phones/countryCodes`)
            .then((codes) => {
                setCountryCodes(codes)
                if (codes.length > 0) {
                    setSelectedCountryCode(codes[0])
                }
            })
            .catch(() => setCountryCodes([]))
    }, [])

    useEffect(() => {
        if (phase === 'success') playSuccess()
        if (phase === 'error') playFail()
    }, [phase])

    useEffect(() => {
        if (phase === 'success' || phase === 'error') {
            const delay = phase === 'success' ? 5000 : 3000
            const timer = setTimeout(onClose, delay)
            return () => clearTimeout(timer)
        }
    }, [phase, onClose])

    const handleDigit = useCallback((digit: string) => {
        setPhoneNo((prev) => prev + digit)
    }, [])

    const handleBackspace = useCallback(() => {
        setPhoneNo((prev) => prev.slice(0, -1))
    }, [])

    const handleSubmit = () => {
        if (!phoneNo) return
        setPhase('loading')
        api.post<CheckinResponse>(`/api/events/${eventId}/checkin/phone`, {
            countryCode: selectedCountryCode,
            phoneNo,
        })
            .then((data) => {
                setResult(data)
                setPhase(data.success ? 'success' : 'error')
            })
            .catch((err) => {
                setErrorMessage(err.message)
                setPhase('error')
            })
    }

    if (!open) return null

    if (phase === 'loading' || phase === 'success' || phase === 'error') {
        return (
            <Dialog open fullScreen>
                <Box
                    sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        p: 8,
                    }}
                >
                    {phase === 'loading' && (
                        <>
                            <CircularProgress size={96}/>
                            <Typography variant="h4" color="text.secondary">
                                Just a moment...
                            </Typography>
                        </>
                    )}
                    {phase === 'success' && result?.success && 'detail' in result && !('reason' in result.detail) && (
                        <>
                            <CheckCircleIcon sx={{fontSize: 128, color: 'success.main'}}/>
                            <Typography variant="h3">Welcome</Typography>
                            <Typography variant="h4" color="text.secondary">
                                {result.detail.title} {result.detail.name}
                            </Typography>
                        </>
                    )}
                    {phase === 'error' && (
                        <>
                            <ErrorIcon sx={{fontSize: 128, color: 'error.main'}}/>
                            <Typography variant="h4" color="error.main">
                                {result && !result.success && 'reason' in result.detail
                                    ? result.detail.reason
                                    : errorMessage || 'Unknown error'}
                            </Typography>
                        </>
                    )}
                </Box>
            </Dialog>
        )
    }

    return (
        <Dialog open fullScreen>
            <Box sx={{display: 'flex', height: '100%'}}>
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        p: 6,
                        bgcolor: 'grey.100',
                    }}
                >
                    <PhoneAndroidIcon sx={{fontSize: 96, color: 'primary.main'}}/>
                    <Typography variant="h5" sx={{textAlign: 'center', maxWidth: 360}}>
                        Enter the phone number you registered for this event.
                    </Typography>
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        p: 4,
                    }}
                >
                    <Stack direction="row" spacing={2} sx={{width: '100%', maxWidth: 360}}>
                        <FormControl sx={{minWidth: 130}}>
                            <InputLabel>Code</InputLabel>
                            <Select
                                value={selectedCountryCode}
                                label="Code"
                                onChange={(e) => setSelectedCountryCode(e.target.value)}
                            >
                                {countryCodes.map((code) => (
                                    <MenuItem key={code} value={code}>
                                        {code}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            fullWidth
                            value={phoneNo}
                            slotProps={{input: {readOnly: true}}}
                            placeholder="Phone number"
                            sx={{flex: 1}}
                            InputProps={{
                                endAdornment: phoneNo ? (
                                    <IconButton onClick={handleBackspace} edge="end" size="small">
                                        <BackspaceIcon/>
                                    </IconButton>
                                ) : undefined,
                            }}
                        />
                    </Stack>
                    <PhoneDialPad
                        onDigit={handleDigit}
                        onBackspace={handleBackspace}
                        disabled={false}
                    />
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            size="large"
                            onClick={onClose}
                            sx={{py: 1.5, fontSize: '1.1rem'}}
                        >
                            Return to QR check-in
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            size="large"
                            startIcon={<CheckIcon/>}
                            disabled={!phoneNo}
                            onClick={handleSubmit}
                            sx={{minWidth: 180, py: 1.5, fontSize: '1.1rem'}}
                        >
                            Check In
                        </Button>
                    </Stack>
                </Box>
            </Box>
        </Dialog>
    )
}
