import {Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography} from '@mui/material'

interface Props {
    open: boolean
    currentMode: string
    pendingMode: string | null
    loading: boolean
    onClose: () => void
    onConfirm: () => void
}

export default function ModeDialog({open, currentMode, pendingMode, loading, onClose, onConfirm}: Props) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>
                Confirm changing from &ldquo;{currentMode}&rdquo; to &ldquo;{pendingMode}&rdquo;
            </DialogTitle>
            <DialogContent>
                {pendingMode === 'test' && (
                    <Typography variant="body2">
                        Attendance will be temporarily recorded. However, any attendance records created
                        during Test mode will be deleted when switching back to Disabled mode.
                    </Typography>
                )}
                {pendingMode === 'disabled' && (
                    <Typography variant="body2">
                        Attendance records created in Live mode will be kept. However, those created in
                        Test mode will be deleted.
                    </Typography>
                )}
                {pendingMode === 'live' && (
                    <Typography variant="body2">
                        The event will now accept live attendance. Attendance records will persist even
                        after check-in is disabled again.
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button onClick={onConfirm} variant="contained" loading={loading}>
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    )
}
