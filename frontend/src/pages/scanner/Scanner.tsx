import {useCallback, useState} from 'react'
import {Box, Button, Typography} from '@mui/material'
import QrCodeIcon from '@mui/icons-material/QrCode'
import {useLocation} from '@tanstack/react-router'
import {Scanner as QrScanner} from '@yudiel/react-qr-scanner'
import {useQuery} from '@tanstack/react-query'
import {useApi} from '../../api'
import BoothImage from './components/BoothImage'
import CheckinResultDialog from './components/CheckinResultDialog'
import CheckinByPhoneDialog from './components/CheckinByPhoneDialog'
import EventDisabledDialog from './components/EventDisabledDialog'
import LoginIcon from '@mui/icons-material/Login';

interface EventResponse {
    id: string
    name: string
    description: string
    date: string
    mode: 'disabled' | 'test' | 'live'
    hasBoothImage: boolean
}

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

type CheckinPhase = 'idle' | 'loading' | 'success' | 'error'

export default function Scanner() {
    const location = useLocation()
    const eventId = location.pathname.split('/').filter(Boolean)[1]
    const api = useApi()

    const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
    const [phoneDialogKey, setPhoneDialogKey] = useState(0)
    const [checkinPhase, setCheckinPhase] = useState<CheckinPhase>('idle')
    const [checkinResult, setCheckinResult] = useState<CheckinResponse | null>(null)

    const scannerPaused = checkinPhase !== 'idle' || phoneDialogOpen

    const {data: event} = useQuery<EventResponse>({
        queryKey: ['event', eventId],
        queryFn: () => api.get<EventResponse>(`/api/events/${eventId}`),
        refetchInterval: 3000,
    })

    const handleScan = useCallback(
        (detectedCodes: { rawValue: string }[]) => {
            if (detectedCodes.length === 0) return
            const token = detectedCodes[0].rawValue
            setCheckinPhase('loading')
            api.postNoAuth<CheckinResponse>(`/api/events/${eventId}/scan`, {ticket: token})
                .then((data) => {
                    setCheckinResult(data)
                    setCheckinPhase(data.success ? 'success' : 'error')
                })
                .catch((err) => {
                    setCheckinResult({success: false, detail: {reason: err.message} as CheckinErrorDetail})
                    setCheckinPhase('error')
                })
        },
        [eventId, api]
    )

    const handleScanDismiss = useCallback(() => {
        setCheckinPhase('idle')
        setCheckinResult(null)
    }, [])

    const handlePhoneOpen = useCallback(() => {
        setPhoneDialogOpen(true)
        setPhoneDialogKey((k) => k + 1)
    }, [])

    const handlePhoneClose = useCallback(() => {
        setPhoneDialogOpen(false)
    }, [])

    if (!event) return null

    if (event.mode === 'disabled') {
        return <EventDisabledDialog/>
    }

    const savedDeviceId = localStorage.getItem('settings.webcamDeviceId') || undefined

    return (
        <Box sx={{display: 'flex', height: '100vh', overflow: 'hidden'}}>
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'grey.200',
                }}
            >
                <BoothImage
                    key={`${eventId}-${event.hasBoothImage}`}
                    eventId={eventId}
                    eventName={event.name}
                    hasBoothImage={event.hasBoothImage}
                />
            </Box>
            <Box
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                <Box
                    sx={{
                        position: 'fixed',
                        left: -9999,
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: 'none',
                    }}
                >
                    <QrScanner
                        paused={scannerPaused}
                        onScan={handleScan}
                        constraints={{deviceId: savedDeviceId}}
                        components={{finder: false, torch: false, onOff: false, zoom: false}}
                        sound={false}
                    />
                </Box>
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3,
                        p: 4,
                    }}
                >
                    <QrCodeIcon sx={{fontSize: 120, color: 'primary.main'}}/>
                    <Typography
                        variant="h3"
                        color="text.secondary"
                        sx={{textAlign: 'center', fontSize: 40, maxWidth: 450, pt: 6}}
                    >
                        Present your QR code ticket to the camera to check in
                    </Typography>
                </Box>
                <Box sx={{p: 4, display: 'flex', justifyContent: 'center'}}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handlePhoneOpen}
                        sx={{py: 2, px: 4, fontSize: '1.8rem'}}
                    >
                        <LoginIcon sx={{fontSize: 50, pr: 2}}/>
                        Check-in without QR Code
                    </Button>
                </Box>
            </Box>
            <CheckinResultDialog
                open={checkinPhase !== 'idle'}
                phase={checkinPhase}
                result={checkinResult}
                onDismiss={handleScanDismiss}
            />
            {phoneDialogOpen && (
                <CheckinByPhoneDialog
                    key={phoneDialogKey}
                    open={phoneDialogOpen}
                    eventId={eventId}
                    onClose={handlePhoneClose}
                />
            )}
        </Box>
    )
}
