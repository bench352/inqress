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
                  Some participants are waiting to be admitted
                </Typography>
              </Stack>
              <Typography variant="body1">
                {pendingCount === 1
                  ? "1 participant joined the list but cannot check in yet."
                  : `${pendingCount} participants joined the list but cannot check in yet.`}{" "}
                Admit or deactivate each one below.
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
                <Typography variant="h6">
                  A data source could not sync
                </Typography>
              </Stack>
              <Typography variant="body1">
                {failedSources[0].name}: {failedSources[0].lastError}
                {failedSources.length > 1
                  ? ` (and ${failedSources.length - 1} more)`
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
          title="Importing participants…"
          progress={createParticipantProgress}
        />
        <ProgressCard
          title="Sending tickets by email…"
          progress={sendEmailProgress}
        />
        <ProgressCard
          title="Making ticket images…"
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
                <Typography variant="h6">Some tickets are not ready</Typography>
              </Stack>
              <Typography variant="body1">
                {notReadyCount === 1
                  ? "1 participant has no ticket image yet."
                  : `${notReadyCount} participants have no ticket image yet.`}{" "}
                Tickets must be made before they can be sent.
              </Typography>
              <Button
                variant="contained"
                loading={generateQrMutation.isPending}
                onClick={() => generateQrMutation.mutate()}
              >
                Make all tickets
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
                <Typography variant="h6">Send tickets by email</Typography>
              </Stack>
              <Typography variant="body1">
                {undeliveredReadyCount === 1
                  ? "1 participant has a ticket ready and an email address. Send it now."
                  : `${undeliveredReadyCount} participants have tickets ready and email addresses. Send them at once.`}
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
                Send tickets
              </Button>
            </Stack>
          </Card>
        )}
      </Stack>
    </>
  );
}
