import { Card, CardActionArea, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import type { ParticipantItem } from "../useEventDetail";
import { maskEmail, maskPhone } from "@/utils/masking";

function getTicketStatus(participant: ParticipantItem): string {
  if (participant.checkedInAt != null) return "Checked in";
  if (!participant.isTicketReady) return "Generating...";
  if (!participant.isTicketDelivered) return "Undelivered";
  return "Delivered";
}

interface Props {
  participant: ParticipantItem;
  onClick: () => void;
}

export function ParticipantCard({ participant, onClick }: Props) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea onClick={onClick} sx={{ height: "100%", p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
          {participant.title ? `${participant.title} ` : ""}
          {participant.name}
        </Typography>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <EmailIcon fontSize="small" color="action" />
            <Typography variant="body1" color="text.secondary">
              {participant.email
                ? maskEmail(participant.email)
                : "(No email address)"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <PhoneIcon fontSize="small" color="action" />
            <Typography variant="body1" color="text.secondary">
              {participant.countryCode && participant.phone
                ? `${participant.countryCode} ${maskPhone(participant.phone)}`
                : "(No phone number)"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <ConfirmationNumberIcon fontSize="small" color="action" />
            <Typography variant="body1" color="text.secondary">
              {getTicketStatus(participant)}
            </Typography>
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
