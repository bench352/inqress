import { Button, Card, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useApi } from "../../../api";
import ProgressCard from "@/components/ProgressCard";

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

  const generateQrMutation = useMutation({
    mutationFn: () => api.post(`/api/events/${eventId}/ticketQRs`, notReadyIds),
  });

  return (
    <>
      <Typography variant="subtitle1">Actions</Typography>
      <Stack spacing={2}>
        <ProgressCard
          title="Importing attendees..."
          progress={createAttendeeProgress}
        />
        <ProgressCard title="Sending emails..." progress={sendEmailProgress} />
        <ProgressCard
          title="Generating ticket QR codes..."
          progress={generateTicketQrProgress}
        />
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
                loading={generateQrMutation.isPending}
                onClick={() => generateQrMutation.mutate()}
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
