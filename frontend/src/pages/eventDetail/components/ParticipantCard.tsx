import { memo } from "react";
import {
  Box,
  Card,
  CardActionArea,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import SyncLockIcon from "@mui/icons-material/SyncLock";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import type { ParticipantItem } from "../useEventDetail";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import dayjs from "dayjs";
import { maskEmail, maskPhone } from "@/utils/masking";

interface Props {
  participant: ParticipantItem;
  onOpen: (participantId: string) => void;
}

export const ParticipantCard = memo(function ParticipantCard({
  participant,
  onOpen,
}: Props) {
  return (
    <Card
      variant="outlined"
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardActionArea
        onClick={() => onOpen(participant.id)}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <Box sx={{ px: 2, py: 2, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }}
            >
              {participant.title ? `${participant.title} ` : ""}
              {participant.name}
            </Typography>
            {participant.managedBy && (
              <Tooltip
                describeChild
                title={
                  participant.detached
                    ? `Detached from ${participant.managedBy.name}`
                    : `Managed by ${participant.managedBy.name}`
                }
              >
                {participant.detached ? (
                  <SyncDisabledIcon
                    fontSize="small"
                    color="action"
                    aria-label={`Detached from ${participant.managedBy.name}`}
                    sx={{ flexShrink: 0 }}
                  />
                ) : (
                  <SyncLockIcon
                    fontSize="small"
                    color="action"
                    aria-label={`Managed by ${participant.managedBy.name}`}
                    sx={{ flexShrink: 0 }}
                  />
                )}
              </Tooltip>
            )}
          </Stack>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <EmailIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.email
                  ? maskEmail(participant.email)
                  : "No email address"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PhoneIcon fontSize="small" color="action" />
              <Typography variant="body1">
                {participant.countryCode && participant.phone
                  ? `${participant.countryCode} ${maskPhone(participant.phone)}`
                  : "No phone number"}
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
              sx={{
                alignItems: "center",
                px: 2,
                py: 1,
                bgcolor: "action.hover",
              }}
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
});
