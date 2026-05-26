import {useEffect, useState} from 'react'
import {
    AppBar,
    Box,
    Container,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from '@mui/material'
import {
    Event as EventIcon,
    Logout as LogoutIcon,
    Menu as MenuIcon,
    Settings as SettingsIcon,
} from '@mui/icons-material'
import {Outlet, useNavigate, useRouter} from '@tanstack/react-router'
import {useAuth} from '../providers/useAuth'

const DRAWER_WIDTH = 240

function DrawerContent() {
    const navigate = useNavigate()
    const {logout} = useAuth()

    return (
        <Box>
            <Toolbar/>
            <List>
                <ListItemButton onClick={() => navigate({to: '/'})}>
                    <ListItemIcon>
                        <EventIcon/>
                    </ListItemIcon>
                    <ListItemText primary="Events"/>
                </ListItemButton>
            </List>
            <Divider/>
            <List>
                <ListItemButton onClick={() => navigate({to: '/settings'})}>
                    <ListItemIcon>
                        <SettingsIcon/>
                    </ListItemIcon>
                    <ListItemText primary="Settings"/>
                </ListItemButton>
                <ListItemButton onClick={logout}>
                    <ListItemIcon>
                        <LogoutIcon/>
                    </ListItemIcon>
                    <ListItemText primary="Logout"/>
                </ListItemButton>
            </List>
        </Box>
    )
}

export default function AppShell() {
    const {isAuthenticated} = useAuth()
    const router = useRouter()
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        if (!isAuthenticated) {
            router.navigate({to: '/login'})
        }
    }, [isAuthenticated, router])

    if (!isAuthenticated) {
        return null
    }

    return (
        <Box sx={{display: 'flex'}}>
            <AppBar
                position="fixed"
                sx={{zIndex: (theme) => theme.zIndex.drawer + 1}}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        sx={{mr: 2, display: {md: 'none'}}}
                    >
                        <MenuIcon/>
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        InQRess
                    </Typography>
                </Toolbar>
            </AppBar>
            <Drawer
                variant="permanent"
                sx={{
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    display: {xs: 'none', md: 'block'},
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                    },
                }}
            >
                <DrawerContent/>
            </Drawer>
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                ModalProps={{keepMounted: true}}
                sx={{
                    display: {xs: 'block', md: 'none'},
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                    },
                }}
            >
                <DrawerContent/>
            </Drawer>
            <Box component="main" sx={{flexGrow: 1, p: 3, width: {md: `calc(100% - ${DRAWER_WIDTH}px)`}}}>
                <Toolbar/>
                <Container fixed>
                    <Outlet/>
                </Container>
            </Box>
        </Box>
    )
}
