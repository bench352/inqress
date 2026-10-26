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
import LabelIcon from "@mui/icons-material/Label";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import EmailIcon from "@mui/icons-material/Email";
import GitHubIcon from "@mui/icons-material/GitHub";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useAppInfo } from "@/providers/useAppInfo";
import SectionHeading from "@/components/SectionHeading";
import CallToActionOutlinedIcon from "@mui/icons-material/CallToActionOutlined";
import LicenseDialog from "./components/LicenseDialog";

export default function Settings() {
  const { orgName, fromHeader, fromError, emailFooterEnabled, appVersion } =
    useAppInfo();
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <SectionHeading icon={<BusinessIcon />}>Organization</SectionHeading>
      <Typography variant="body1" color="textSecondary">
        Ask your system administrator to change these details.
      </Typography>
      <List dense disablePadding sx={{ pt: 1, mb: 2 }}>
        <ListItem disableGutters>
          <ListItemIcon>
            <DriveFileRenameOutlineIcon />
          </ListItemIcon>
          <ListItemText primary="Name" secondary={orgName} />
        </ListItem>
        <ListItem disableGutters>
          <ListItemIcon>
            <EmailIcon />
          </ListItemIcon>
          <ListItemText
            primary="Email sender"
            secondary={fromError ?? fromHeader}
            slotProps={{
              secondary: { color: fromError ? "error" : "textSecondary" },
            }}
          />
        </ListItem>
        <ListItem disableGutters>
          <ListItemIcon>
            <CallToActionOutlinedIcon />
          </ListItemIcon>
          <ListItemText
            primary="InQRess email footer"
            secondary={
              emailFooterEnabled
                ? 'Enabled. Email sent would show "This email was sent automatically by InQRess, an open-source QR ticketing system."'
                : "Disabled. Only message template content is sent."
            }
          />
        </ListItem>
      </List>

      <SectionHeading icon={<InfoOutlinedIcon />}>About InQRess</SectionHeading>
      <List dense disablePadding sx={{ pt: 1 }}>
        <ListItem disableGutters>
          <ListItemIcon>
            <LabelIcon />
          </ListItemIcon>
          <ListItemText primary="Version" secondary={appVersion} />
        </ListItem>
        <ListItemButton
          disableGutters
          onClick={() => setLicenseDialogOpen(true)}
        >
          <ListItemIcon>
            <DescriptionOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary="License" secondary="MIT License" />
        </ListItemButton>
        <ListItemButton
          disableGutters
          onClick={() => window.open("https://github.com/bench352/inqress")}
        >
          <ListItemIcon>
            <GitHubIcon />
          </ListItemIcon>
          <ListItemText
            primary="GitHub repository"
            secondary="Star it or report an issue"
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
