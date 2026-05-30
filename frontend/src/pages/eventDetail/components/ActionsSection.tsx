import {
  Button,
  Card,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useApi } from "../../../api";

interface ProgressState {
  inProgress: boolean;
  numCompleted: number;
  numTotal: number;
  estRemainMin: number | null;
  numErrors: number;
}

interface Props {
  eventId: string;
  undeliveredReadyCount: number;
  notReadyCount: number;
  notReadyIds: string[];
  createAttendeeProgress: ProgressState | null;
  sendEmailProgress: ProgressState | null;
  generateTicketQrProgress: ProgressState | null;
}

export default function ActionsSection({
  eventId,
  undeliveredReadyCount,
  notReadyCount,
  notReadyIds,
  createAttendeeProgress,
  sendEmailProgress,
  generateTicketQrProgress,
}: Props) {
  const navigate = useNavigate();
  const api = useApi();
  const [generating, setGenerating] = useState(false);

  return (
    <>
      <Typography variant="subtitle1">Actions</Typography>
      <Stack spacing={2}>
        {!!createAttendeeProgress?.inProgress && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">
                Importing attendees...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  createAttendeeProgress && createAttendeeProgress.numTotal > 0
                    ? (createAttendeeProgress.numCompleted /
                        createAttendeeProgress.numTotal) *
                      100
                    : 0
                }
              />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  {createAttendeeProgress.numCompleted} /{" "}
                  {createAttendeeProgress.numTotal} attendees completed
                  {createAttendeeProgress.numErrors > 0 && (
                    <>
                      {" "}
                      ({createAttendeeProgress.numErrors} error
                      {createAttendeeProgress.numErrors !== 1 ? "s" : ""})
                    </>
                  )}
                </Typography>
                {createAttendeeProgress.estRemainMin != null && (
                  <Typography variant="body2" color="text.secondary">
                    Estimated {createAttendeeProgress.estRemainMin} minute
                    {createAttendeeProgress.estRemainMin !== 1 ? "s" : ""}{" "}
                    remaining.
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        )}

        {!!sendEmailProgress?.inProgress && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">Sending emails...</Typography>
              <LinearProgress
                variant="determinate"
                value={
                  sendEmailProgress && sendEmailProgress.numTotal > 0
                    ? (sendEmailProgress.numCompleted /
                        sendEmailProgress.numTotal) *
                      100
                    : 0
                }
              />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  {sendEmailProgress.numCompleted} /{" "}
                  {sendEmailProgress.numTotal} emails sent
                  {sendEmailProgress.numErrors > 0 && (
                    <>
                      {" "}
                      ({sendEmailProgress.numErrors} error
                      {sendEmailProgress.numErrors !== 1 ? "s" : ""})
                    </>
                  )}
                </Typography>
                {sendEmailProgress.estRemainMin != null && (
                  <Typography variant="body2" color="text.secondary">
                    Estimated {sendEmailProgress.estRemainMin} minute
                    {sendEmailProgress.estRemainMin !== 1 ? "s" : ""} remaining.
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        )}

        {!!generateTicketQrProgress?.inProgress && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1">
                Generating ticket QR codes...
              </Typography>
              <LinearProgress
                variant="determinate"
                value={
                  generateTicketQrProgress &&
                  generateTicketQrProgress.numTotal > 0
                    ? (generateTicketQrProgress.numCompleted /
                        generateTicketQrProgress.numTotal) *
                      100
                    : 0
                }
              />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  {generateTicketQrProgress.numCompleted} /{" "}
                  {generateTicketQrProgress.numTotal} QR codes generated
                  {generateTicketQrProgress.numErrors > 0 && (
                    <>
                      {" "}
                      ({generateTicketQrProgress.numErrors} error
                      {generateTicketQrProgress.numErrors !== 1 ? "s" : ""})
                    </>
                  )}
                </Typography>
                {generateTicketQrProgress.estRemainMin != null && (
                  <Typography variant="body2" color="text.secondary">
                    Estimated {generateTicketQrProgress.estRemainMin} minute
                    {generateTicketQrProgress.estRemainMin !== 1 ? "s" : ""}{" "}
                    remaining.
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        )}

        {notReadyCount > 0 && !generateTicketQrProgress?.inProgress && (
          <Card sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <QrCodeIcon color="primary" />
                <Typography variant="h6">
                  Generate ticket QR codes for all attendees
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {notReadyCount} attendee(s) don't have a ticket QR code yet.
                This must be done before delivering tickets.
              </Typography>
              <Button
                variant="contained"
                loading={generating}
                onClick={async () => {
                  setGenerating(true);
                  try {
                    await api.post(
                      `/api/events/${eventId}/ticketQRs`,
                      notReadyIds,
                    );
                  } finally {
                    setGenerating(false);
                  }
                }}
              >
                Generate all ticket QR codes
              </Button>
            </Stack>
          </Card>
        )}

        {undeliveredReadyCount > 0 && !sendEmailProgress?.inProgress && (
          <Card sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <EmailIcon color="primary" />
                <Typography variant="h6">
                  Deliver tickets to all attendees in one click
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {undeliveredReadyCount} attendee(s) haven't received their
                ticket yet. Click here to send tickets to all undelivered
                attendees.
              </Typography>
              <Button
                variant="contained"
                onClick={() =>
                  navigate({
                    to: "/events/$eventId/bulkTicketDelivery",
                    params: { eventId },
                  })
                }
              >
                Bulk ticket delivery to undelivered attendees
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </>
  );
}
