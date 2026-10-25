import { useState } from "react";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useAppInfo } from "@/providers/useAppInfo";
import LicenseDialog from "./components/LicenseDialog";

export default function Settings() {
  const { orgName, fromHeader, fromError, appVersion } = useAppInfo();
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  return (
    <>
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
            primary="From"
            secondary={fromError ?? fromHeader}
            slotProps={{
              secondary: { color: fromError ? "error" : "text.secondary" },
            }}
          />
        </ListItem>
      </List>

      <Typography variant="h6">About This App</Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            <InfoOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="App Version" secondary={appVersion} />
        </ListItem>
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

      <LicenseDialog
        open={licenseDialogOpen}
        onClose={() => setLicenseDialogOpen(false)}
      />
    </>
  );
}
