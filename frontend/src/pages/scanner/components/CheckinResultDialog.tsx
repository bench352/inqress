import {useEffect} from 'react'
import {Box, CircularProgress, Dialog, Typography} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import useSound from 'use-sound'
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

type CheckinPhase = 'idle' | 'loading' | 'success' | 'error'

interface Props {
    open: boolean
    phase: CheckinPhase
    result: CheckinResponse | null
    onDismiss: () => void
}

export default function CheckinResultDialog({open, phase, result, onDismiss}: Props) {
    const [playSuccess] = useSound(successSound, {volume: 0.5})
    const [playFail] = useSound(failSound, {volume: 0.5})

    useEffect(() => {
        if (phase === 'success') playSuccess()
        if (phase === 'error') playFail()
    }, [phase])

    useEffect(() => {
        if (phase === 'loading') return
        const delay = phase === 'success' ? 5000 : 3000
        const timer = setTimeout(onDismiss, delay)
        return () => clearTimeout(timer)
    }, [phase, onDismiss])

    return (
        <Dialog open={open} fullScreen>
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
                {phase === 'success' && result?.success && (
                    <>
                        <CheckCircleIcon sx={{fontSize: 128, color: 'success.main'}}/>
                        <Typography variant="h3">Welcome</Typography>
                        <Typography variant="h4" color="text.secondary">
                            {'detail' in result && !('reason' in result.detail)
                                ? `${result.detail.title} ${result.detail.name}`
                                : ''}
                        </Typography>
                    </>
                )}
                {phase === 'error' && result && !result.success && (
                    <>
                        <ErrorIcon sx={{fontSize: 128, color: 'error.main'}}/>
                        <Typography variant="h4" color="error.main">
                            {'reason' in result.detail
                                ? result.detail.reason
                                : 'Unknown error'}
                        </Typography>
                    </>
                )}
            </Box>
        </Dialog>
    )
}
