import {useState} from 'react'
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import PhoneIcon from '@mui/icons-material/Phone'
import QrCodeIcon from '@mui/icons-material/QrCode'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {apiUrl} from '../../../api'
import {useAuth} from '../../../providers/useAuth'
import type {AttendeeItem} from '../useEventDetail'
import PreviewTicketDialog from './PreviewTicketDialog'
import EmailTicketDialog from './EmailTicketDialog'

type SubView = 'main' | 'preview' | 'email' | 'deliver' | 'delete'

interface Props {
    open: boolean
    attendee: AttendeeItem
    eventId: string
    eventName: string
    onClose: () => void
}

export default function AttendeeDetailsDialog({open, attendee, eventId, eventName, onClose}: Props) {
    const {username, password} = useAuth()
    const queryClient = useQueryClient()
    const [subView, setSubView] = useState<SubView>('main')

    const deliverMutation = useMutation({
        mutationFn: async () => {
            const headers: Record<string, string> = {}
            if (username && password) {
                headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
            }
            const res = await fetch(`${apiUrl}/api/events/${eventId}/attendees/${attendee.id}/ticket/delivery`, {
                method: 'POST',
                headers,
            })
            if (!res.ok) throw new Error(`${res.status}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['attendees', eventId]})
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const headers: Record<string, string> = {'Content-Type': 'application/json'}
            if (username && password) {
                headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
            }
            const res = await fetch(`${apiUrl}/api/events/${eventId}/attendees`, {
                method: 'DELETE',
                headers,
                body: JSON.stringify([attendee.id]),
            })
            if (!res.ok) throw new Error(`${res.status}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['attendees', eventId]})
            onClose()
        },
    })

    const handleDeliver = () => setSubView('deliver')

    const handleDeliverConfirm = () => {
        deliverMutation.mutate(undefined, {
            onSuccess: () => setSubView('main'),
        })
    }

    const handleDeleteConfirm = () => deleteMutation.mutate()

    const handleClose = () => {
        setSubView('main')
        onClose()
    }

    if (subView === 'preview') {
        return (
            <PreviewTicketDialog
                open
                eventId={eventId}
                attendeeId={attendee.id}
                onClose={() => setSubView('main')}
            />
        )
    }

    if (subView === 'email') {
        return (
            <EmailTicketDialog
                open
                eventId={eventId}
                attendeeId={attendee.id}
                attendeeEmail={attendee.email}
                eventName={eventName}
                onClose={() => setSubView('main')}
            />
        )
    }

    if (subView === 'deliver') {
        return (
            <Dialog open onClose={() => setSubView('main')}>
                <DialogTitle>Mark Ticket Delivered</DialogTitle>
                <DialogContent>
                    <Typography>
                        Mark the ticket as delivered for {attendee.title} {attendee.name}?
                        This will not send an email.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubView('main')} disabled={deliverMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeliverConfirm}
                        variant="contained"
                        loading={deliverMutation.isPending}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        )
    }

    if (subView === 'delete') {
        return (
            <Dialog open onClose={() => setSubView('main')}>
                <DialogTitle>Delete Attendee</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {attendee.title} {attendee.name}?
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubView('main')} disabled={deleteMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        variant="contained"
                        color="error"
                        loading={deleteMutation.isPending}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Attendee Details</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{mt: 1}}>
                    <Typography variant="h6">
                        {attendee.title} {attendee.name}
                    </Typography>
                    <Stack spacing={0.75}>
                        <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                            <EmailIcon fontSize="small" color="action"/>
                            <Typography variant="body2">
                                {attendee.email}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                            <PhoneIcon fontSize="small" color="action"/>
                            <Typography variant="body2">
                                {attendee.countryCode} {attendee.phone}
                            </Typography>
                        </Stack>
                    </Stack>

                    <List disablePadding>
                        <ListItemButton
                            onClick={() => setSubView('preview')}
                            disabled={!attendee.isTicketReady}
                        >
                            <ListItemIcon><QrCodeIcon/></ListItemIcon>
                            <ListItemText
                                primary="Preview ticket"
                                secondary={!attendee.isTicketReady ? 'Ticket image is still generating' : undefined}
                            />
                        </ListItemButton>
                        <ListItemButton
                            onClick={() => setSubView('email')}
                            disabled={!attendee.isTicketReady}
                        >
                            <ListItemIcon><EmailIcon/></ListItemIcon>
                            <ListItemText
                                primary="Email ticket"
                                secondary={!attendee.isTicketReady ? 'Ticket image is still generating' : undefined}
                            />
                        </ListItemButton>
                        <ListItemButton
                            onClick={handleDeliver}
                            disabled={!attendee.isTicketReady || attendee.isTicketDelivered || deliverMutation.isPending}
                        >
                            <ListItemIcon><LocalOfferIcon/></ListItemIcon>
                            <ListItemText
                                primary="Mark ticket delivered"
                                secondary={
                                    !attendee.isTicketReady
                                        ? 'Ticket image is still generating'
                                        : attendee.isTicketDelivered
                                            ? 'Already marked as delivered'
                                            : undefined
                                }
                            />
                        </ListItemButton>
                        <ListItemButton onClick={() => setSubView('delete')}>
                            <ListItemIcon><DeleteIcon color="error"/></ListItemIcon>
                            <ListItemText
                                primary="Delete attendee"
                                slotProps={{primary: {sx: {color: 'error.main'}}}}
                            />
                        </ListItemButton>
                    </List>
                </Stack>
            </DialogContent>
        </Dialog>
    )
}
