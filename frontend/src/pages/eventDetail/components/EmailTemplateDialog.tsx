import {useEffect, useState} from 'react'
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Typography,
} from '@mui/material'
import Editor from '@monaco-editor/react'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {apiUrl} from '../../../api'
import {useAuth} from '../../../providers/useAuth'

interface Props {
    open: boolean
    eventId: string
    onClose: () => void
}

export default function EmailTemplateDialog({open, eventId, onClose}: Props) {
    const {username, password} = useAuth()
    const queryClient = useQueryClient()
    const [template, setTemplate] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const headers: Record<string, string> = {}
        if (username && password) {
            headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
        }
        let cancelled = false
        fetch(`${apiUrl}/api/events/${eventId}/emailTemplate`, {headers})
            .then((res) => {
                if (cancelled) return
                if (!res.ok) throw new Error(`${res.status}`)
                return res.json()
            })
            .then((data: { text: string }) => {
                if (!cancelled) {
                    setTemplate(data.text)
                    setLoading(false)
                }
            })
            .catch(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [eventId, username, password])

    const saveMutation = useMutation({
        mutationFn: async (text: string) => {
            const headers: Record<string, string> = {'Content-Type': 'application/json'}
            if (username && password) {
                headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
            }
            const res = await fetch(`${apiUrl}/api/events/${eventId}/emailTemplate`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({text}),
            })
            if (!res.ok) throw new Error(`${res.status}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['event', eventId]})
            onClose()
        },
    })

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth key={`email-template-${open}`}>
            <DialogTitle>Edit Email Template</DialogTitle>
            <DialogContent sx={{minHeight: 400}}>
                <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                    Customize the HTML template below to personalize your ticket delivery email.
                    Use the following placeholders; they will be replaced with attendee-specific
                    information when the email is sent:
                </Typography>
                <Box component="ul" sx={{pl: 3, mt: 0, mb: 2}}>
                    {[
                        {code: '{{ title }}', desc: 'Honorific (e.g. Mr, Mrs, Dr)'},
                        {code: '{{ fullName }}', desc: 'Full name of the attendee'},
                        {code: '{{ eventName }}', desc: 'Name of the event'},
                        {code: '{{ ticketQR }}', desc: 'Embedded QR code ticket image'},
                    ].map(({code, desc}) => (
                        <Typography key={code} variant="body2" component="li" color="text.secondary">
                            <Box component="code" sx={{fontFamily: 'monospace', fontWeight: 600}}>
                                {code}
                            </Box>
                            {': '}{desc}
                        </Typography>
                    ))}
                </Box>
                {loading ? (
                    <CircularProgress sx={{display: 'flex', justifyContent: 'center', mt: 4}}/>
                ) : template !== null ? (
                    <Paper variant="outlined" sx={{overflow: 'hidden'}}>
                        <Editor
                            height="400px"
                            defaultLanguage="html"
                            value={template}
                            onChange={(value) => setTemplate(value ?? '')}
                            options={{minimap: {enabled: false}, fontSize: 14}}
                        />
                    </Paper>
                ) : (
                    <Typography color="error">Failed to load template.</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
                <Button
                    onClick={() => saveMutation.mutate(template ?? '')}
                    variant="contained"
                    loading={saveMutation.isPending}
                    disabled={template === null}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    )
}
