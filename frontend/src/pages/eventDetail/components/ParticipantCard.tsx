import {
  Box,
  Card,
  CardActionArea,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import type { ParticipantItem } from "../useEventDetail";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import dayjs from "dayjs";
import { maskEmail, maskPhone } from "@/utils/masking";

interface Props {
  participant: ParticipantItem;
  onClick: () => void;
}

export function ParticipantCard({ participant, onClick }: Props) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {participant.title ? `${participant.title} ` : ""}
            {participant.name}
          </Typography>
          <Stack spacing={0.25}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.email
                  ? maskEmail(participant.email)
                  : "(No email address)"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.countryCode && participant.phone
                  ? `${participant.countryCode} ${maskPhone(participant.phone)}`
                  : "(No phone number)"}
              </Typography>
            </Stack>
          </Stack>
        </Box>
        {participant.checkedInAt && (
          <>
            <Divider />
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", px: 2, py: 0.5, bgcolor: "grey.100" }}
            >
              <CheckCircleIcon fontSize="small" color="success" />
              <Typography variant="body1" color="success">
                {dayjs(participant.checkedInAt).format("MMM D, YYYY h:mm A")}
              </Typography>
            </Stack>
          </>
        )}
      </CardActionArea>
    </Card>
  );
}
