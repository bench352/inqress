import {useState} from 'react'
import {
    Card,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material'
import VideocamIcon from '@mui/icons-material/Videocam'
import WebcamSettingsDialog from './components/WebcamSettingsDialog'

export default function Settings() {
    const [webcamDialogOpen, setWebcamDialogOpen] = useState(false)

    return (
        <>
            <Typography variant="h4" sx={{mb: 2}}>
                Settings
            </Typography>
            <Card>
                <Typography variant="subtitle1" sx={{px: 2, pt: 2, pb: 1}}>
                    Scanner Booth
                </Typography>
                <List>
                    <ListItemButton onClick={() => setWebcamDialogOpen(true)}>
                        <ListItemIcon>
                            <VideocamIcon/>
                        </ListItemIcon>
                        <ListItemText primary="Webcam settings"/>
                    </ListItemButton>
                </List>
            </Card>
            <WebcamSettingsDialog
                open={webcamDialogOpen}
                onClose={() => setWebcamDialogOpen(false)}
            />
        </>
    )
}
