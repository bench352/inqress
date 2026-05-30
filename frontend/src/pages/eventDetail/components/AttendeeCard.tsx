import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import type { AttendeeItem } from "../useEventDetail";

function getTicketStatus(attendee: AttendeeItem): string {
  if (attendee.checkedInAt != null) return "Checked in";
  if (!attendee.isTicketReady) return "Generating...";
  if (!attendee.isTicketDelivered) return "Undelivered";
  return "Delivered";
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 3) return email;
  return email.substring(0, 3) + "***" + email.substring(at);
}

function maskPhone(phone: string): string {
  if (phone.length <= 3) return phone;
  return phone.substring(0, 3) + "***";
}

interface Props {
  attendee: AttendeeItem;
  onClick: () => void;
}

export default function AttendeeCard({ attendee, onClick }: Props) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {attendee.title} {attendee.name}
          </Typography>
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {maskEmail(attendee.email)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {attendee.countryCode} {maskPhone(attendee.phone)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <ConfirmationNumberIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {getTicketStatus(attendee)}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
