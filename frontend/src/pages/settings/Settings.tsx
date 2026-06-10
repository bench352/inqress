import { useState } from "react";
import {
  Container,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import ApiIcon from "@mui/icons-material/Api";
import BusinessIcon from "@mui/icons-material/Business";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import VideocamIcon from "@mui/icons-material/Videocam";
import { useAppInfo } from "@/providers/useAppInfo";
import WebcamSettingsDialog from "./components/WebcamSettingsDialog";
import LicenseDialog from "./components/LicenseDialog";

export default function Settings() {
  const { orgName, sendViaEmail, appVersion } = useAppInfo();
  const [webcamDialogOpen, setWebcamDialogOpen] = useState(false);
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  return (
    <Container maxWidth="md" disableGutters>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Typography variant="h6">Owner's Information</Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
        Contact your system administrator to update these details.
      </Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            <BusinessIcon />
          </ListItemIcon>
          <ListItemText primary="Organization" secondary={orgName} />
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <EmailIcon />
          </ListItemIcon>
          <ListItemText
            primary="Email (for ticket delivery)"
            secondary={sendViaEmail}
          />
        </ListItem>
      </List>

      <Typography variant="h6">Check-in Booth</Typography>
      <List>
        <ListItemButton onClick={() => setWebcamDialogOpen(true)}>
          <ListItemIcon>
            <VideocamIcon />
          </ListItemIcon>
          <ListItemText
            primary="Webcam settings"
            secondary="Settings only apply to this device"
          />
        </ListItemButton>
      </List>

      <Typography variant="h6">About This App</Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            <InfoOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="App Version" secondary={appVersion} />
        </ListItem>
        <ListItemButton onClick={() => window.open("/docs")}>
          <ListItemIcon>
            <ApiIcon />
          </ListItemIcon>
          <ListItemText primary="API Documentation" secondary="For the nerds" />
        </ListItemButton>
        <ListItemButton onClick={() => setLicenseDialogOpen(true)}>
          <ListItemIcon>
            <DescriptionOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="License" secondary="MIT License" />
        </ListItemButton>
        <ListItemButton
          onClick={() => window.open("https://github.com/bench352/inqress")}
        >
          <ListItemIcon>
            <GitHubIcon />
          </ListItemIcon>
          <ListItemText
            primary="GitHub Repository"
            secondary="Star this repository or report issues"
          />
        </ListItemButton>
      </List>

      <WebcamSettingsDialog
        open={webcamDialogOpen}
        onClose={() => setWebcamDialogOpen(false)}
      />
      <LicenseDialog
        open={licenseDialogOpen}
        onClose={() => setLicenseDialogOpen(false)}
      />
    </Container>
  );
}
