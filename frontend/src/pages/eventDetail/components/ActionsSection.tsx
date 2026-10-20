import { Button, Card, Stack, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import QrCodeIcon from "@mui/icons-material/QrCode";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useApi } from "@/api.ts";
import ProgressCard from "@/components/ProgressCard";
import PlayCircleFilledWhiteOutlinedIcon from "@mui/icons-material/PlayCircleFilledWhiteOutlined";
import type { DataSourceResponse } from "@/pages/dataSources/types";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";

interface ProgressState {
  inProgress: boolean;
  numCompleted: number;
  numTotal: number;
  estRemainMin: number | null;
  numErrors: number;
}

interface Props {
  eventId: string;
  pendingCount: number;
  undeliveredReadyCount: number;
  notReadyCount: number;
  notReadyIds: string[];
  createParticipantProgress: ProgressState | null;
  sendEmailProgress: ProgressState | null;
  generateTicketQrProgress: ProgressState | null;
}

export default function ActionsSection({
  eventId,
  pendingCount,
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

  const dataSourcesQuery = useQuery<DataSourceResponse[]>({
    queryKey: ["dataSources", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/dataSources`),
    enabled: !!eventId,
  });
  const failedSources = (dataSourcesQuery.data ?? []).filter(
    (source) => source.lastError,
  );

  return (
    <>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
        <PlayCircleFilledWhiteOutlinedIcon />
        <Typography variant="h5">Actions</Typography>
      </Stack>
      <Stack spacing={2}>
        {pendingCount > 0 && (
          <Card variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <EmojiPeopleIcon color="primary" />
                <Typography variant="h6">
                  New participants are waiting to be admitted
                </Typography>
              </Stack>
              <Typography variant="body1">
                {`${pendingCount} participant(s) have been added but not yet admitted. Please check and decide whether they're allowed to attend by admit/deactivate their registration.`}
              </Typography>
              <Button
                variant="contained"
                onClick={() =>
                  document
                    .getElementById("pending-participants")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Review participants
              </Button>
            </Stack>
          </Card>
        )}
        {failedSources.length > 0 && (
          <Card variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <ErrorOutlineIcon color="warning" />
                <Typography variant="h6">Data source sync failed</Typography>
              </Stack>
              <Typography variant="body1">
                {failedSources[0].name}: {failedSources[0].lastError}
                {failedSources.length > 1
                  ? ` (and ${failedSources.length - 1} more source(s))`
                  : ""}
              </Typography>
              <Button
                variant="contained"
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/dataSources",
                    params: { eventId },
                  })
                }
              >
                Open data sources
              </Button>
            </Stack>
          </Card>
        )}
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
          <Card variant="outlined" sx={{ p: 2 }}>
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
              <Typography variant="body1">
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
          <Card variant="outlined" sx={{ p: 2 }}>
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
              <Typography variant="body1">
                {undeliveredReadyCount === 1
                  ? "1 participant is waiting for ticket delivery and has registered their email address. Click here to send the ticket at once."
                  : `${undeliveredReadyCount} participants are waiting for ticket delivery and have registered their email addresses. Click here to send tickets to them at once.`}
              </Typography>
              <Button
                variant="contained"
                onClick={() =>
                  navigate({
                    to: "/admin/events/$eventId/bulkTicketDelivery",
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
