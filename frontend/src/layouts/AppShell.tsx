import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Collapse,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  Event as EventIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import {
  Outlet,
  useMatches,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useAuth } from "../providers/useAuth";
import { useAdminStream } from "../hooks/useAdminStream";
import BoothControlPanel from "../components/BoothControlPanel";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

const DRAWER_WIDTH = 240;

function DrawerContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { activeBooths } = useAdminStream();

  return (
    <Box>
      <Toolbar />
      <List>
        <ListItemButton onClick={() => navigate({ to: "/" })}>
          <ListItemIcon>
            <EventIcon />
          </ListItemIcon>
          <ListItemText primary="Events" />
        </ListItemButton>
      </List>
      <Divider />
      <Collapse in={activeBooths.length > 0}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            justifyContent: "center",
            alignItems: "center",
            py: 1,
          }}
        >
          <QrCodeScannerIcon />
          <Typography variant="h6">Booth control</Typography>
        </Stack>
        {activeBooths.map((booth) => (
          <BoothControlPanel
            key={booth.eventId}
            eventId={booth.eventId}
            eventName={booth.eventName}
          />
        ))}
        <Divider />
      </Collapse>

      <List>
        <ListItemButton onClick={() => navigate({ to: "/settings" })}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </ListItemButton>
        <ListItemButton onClick={logout}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
    </Box>
  );
}

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const matches = useMatches();
  const [mobileOpen, setMobileOpen] = useState(false);
  const fullWidth = useMemo(
    () => matches.some((m) => m.staticData?.fullWidth),
    [matches],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      router.navigate({ to: "/login" });
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
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
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <DrawerContent />
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <DrawerContent />
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: fullWidth ? 0 : 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        {fullWidth ? (
          <Outlet />
        ) : (
          <Container fixed>
            <Outlet />
          </Container>
        )}
      </Box>
    </Box>
  );
}
