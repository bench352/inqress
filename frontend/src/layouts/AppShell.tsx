import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import {
  Event as EventIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import {
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
} from "@tanstack/react-router";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SnackbarProvider } from "notistack";
import { useAuth } from "../providers/useAuth";
import { redirectToLogin } from "../providers/redirectToLogin";
import QueryClientProvider from "../providers/QueryClientProvider";
import AppInfoProvider from "../providers/AppInfoProvider";
import SnackbarAlert from "../components/SnackbarAlert";

const DRAWER_WIDTH = 240;

/** Admin-only app context. Lives here so companion pages never download it. */
function AdminProviders({ children }: PropsWithChildren) {
  return (
    <SnackbarProvider
      maxSnack={6}
      autoHideDuration={10000}
      Components={{
        default: SnackbarAlert,
        success: SnackbarAlert,
        error: SnackbarAlert,
        warning: SnackbarAlert,
        info: SnackbarAlert,
      }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <QueryClientProvider>
          <AppInfoProvider>{children}</AppInfoProvider>
        </QueryClientProvider>
      </LocalizationProvider>
    </SnackbarProvider>
  );
}

function DrawerContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const pathname = useLocation({ select: (l) => l.pathname });

  return (
    <Box>
      <Toolbar />
      <List>
        <ListItemButton
          selected={
            pathname === "/admin" || pathname.startsWith("/admin/events")
          }
          onClick={() => navigate({ to: "/admin" })}
        >
          <ListItemIcon>
            <EventIcon />
          </ListItemIcon>
          <ListItemText primary="Events" />
        </ListItemButton>
      </List>
      <Divider />

      <List>
        <ListItemButton
          selected={pathname.startsWith("/admin/settings")}
          onClick={() => navigate({ to: "/admin/settings" })}
        >
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
  const matches = useMatches();
  const [mobileOpen, setMobileOpen] = useState(false);
  const fullWidth = useMemo(
    () => matches.some((m) => m.staticData?.fullWidth),
    [matches],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      redirectToLogin(`${window.location.pathname}${window.location.search}`);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminProviders>
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
            minWidth: 0,
            p: fullWidth ? 0 : { xs: 2, sm: 3 },
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          }}
        >
          <Toolbar />
          {fullWidth ? (
            <Outlet />
          ) : (
            <Container maxWidth="md" disableGutters>
              <Outlet />
            </Container>
          )}
        </Box>
      </Box>
    </AdminProviders>
  );
}
