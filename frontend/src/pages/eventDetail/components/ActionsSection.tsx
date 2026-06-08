import { Button, Card, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/api.ts";
import ProgressCard from "@/components/ProgressCard";
import PlayCircleFilledWhiteOutlinedIcon from "@mui/icons-material/PlayCircleFilledWhiteOutlined";

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
  createParticipantProgress: ProgressState | null;
  sendEmailProgress: ProgressState | null;
  generateTicketQrProgress: ProgressState | null;
}

export default function ActionsSection({
  eventId,
  undeliveredReadyCount,
  notReadyCount,
  notReadyIds,
  createParticipantProgress,
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
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <PlayCircleFilledWhiteOutlinedIcon />
        <Typography variant="h5" color="text.secondary">
          Actions
        </Typography>
      </Stack>
      <Stack spacing={2}>
        <ProgressCard
          title="Importing participants..."
          progress={createParticipantProgress}
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
                  Generate ticket QR codes for all participants
                </Typography>
              </Stack>
              <Typography variant="body1" color="text.secondary">
                {notReadyCount} participant(s) don't have a ticket QR code yet.
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
                  Deliver tickets to participants in one click
                </Typography>
              </Stack>
              <Typography variant="body1" color="text.secondary">
                {undeliveredReadyCount === 1
                  ? "1 participant is waiting for ticket delivery and has registered their email address. Click here to send the ticket at once."
                  : `${undeliveredReadyCount} participants are waiting for ticket delivery and have registered their email addresses. Click here to send tickets to them at once.`}
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
                Bulk ticket delivery to undelivered participants
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </>
  );
}
