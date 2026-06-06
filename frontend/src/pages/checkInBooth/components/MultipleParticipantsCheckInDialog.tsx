import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Card, Dialog, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmailIcon from "@mui/icons-material/Email";
import GroupsIcon from "@mui/icons-material/Groups";
import PhoneIcon from "@mui/icons-material/Phone";
import useSound from "use-sound";
import successSound from "../../../assets/soundEffects/checkin_success.aac";
import multipleParticipantsSound from "../../../assets/soundEffects/multiple_participants.aac";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../../api";
import { maskEmail, maskPhone } from "@/utils/masking";

const INITIAL_TIMEOUT_S = 60;
const ALL_DONE_TIMEOUT_S = 5;

interface Participant {
  id: string;
  title: string | null;
  name: string;
  email: string | null;
  countryCode: string | null;
  phone: string | null;
  checkedInAt: string | null;
}

interface Props {
  open: boolean;
  eventId: string;
  accentColor: string;
  participants: Participant[];
  onClose: () => void;
}

export default function MultipleParticipantsCheckInDialog({
  open,
  eventId,
  accentColor,
  participants,
  onClose,
}: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [playSuccess] = useSound(successSound);
  const [playMultiple] = useSound(multipleParticipantsSound);
  const [countdown, setCountdown] = useState(INITIAL_TIMEOUT_S);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef(INITIAL_TIMEOUT_S);
  const allCheckedInHandledRef = useRef(false);
  const allCheckedInRef = useRef(false);

  const allCheckedIn =
    participants.length > 0 &&
    participants.every((p) => p.checkedInAt != null || checkedInIds.has(p.id));

  useEffect(() => {
    allCheckedInRef.current = allCheckedIn;
  }, [allCheckedIn]);

  const resetTimer = useCallback((seconds: number) => {
    countdownRef.current = seconds;
    setCountdown(seconds);
  }, []);

  useEffect(() => {
    if (!open) return;

    timerRef.current = setInterval(() => {
      if (allCheckedInRef.current && !allCheckedInHandledRef.current) {
        allCheckedInHandledRef.current = true;
        countdownRef.current = ALL_DONE_TIMEOUT_S;
        setCountdown(ALL_DONE_TIMEOUT_S);
        return;
      }

      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      playMultiple();
    }
  }, [open, playMultiple]);

  const checkinMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const data = await api.post<{
        success: boolean;
        detail: { reason?: string } | Record<string, unknown>;
      }>(`/api/events/${eventId}/checkin/manual`, {
        participantId,
      });
      if (!data.success) {
        throw new Error(
          "reason" in data.detail && typeof data.detail.reason === "string"
            ? data.detail.reason
            : "Check-in failed",
        );
      }
      return data;
    },
    onSuccess: (_, participantId) => {
      setCheckedInIds((prev) => new Set(prev).add(participantId));
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
      if (!allCheckedIn) {
        resetTimer(INITIAL_TIMEOUT_S);
      }
    },
  });

  const handleCheckin = (participantId: string) => {
    checkinMutation.mutate(participantId);
  };

  return (
    <Dialog open={open} scroll="body" fullScreen>
      <Stack
        fullwidth
        direction="column"
        spacing={3}
        sx={{
          justifyContent: "center",
          alignItems: "center",
          p: 4,
        }}
      >
        <GroupsIcon sx={{ fontSize: 120, color: accentColor }} />
        <Typography variant="h2" color="text.secondary">
          Multiple participants found
        </Typography>
        <Typography variant="h5" color="text.secondary">
          Select the correct participant to check in
        </Typography>

        {participants.map((p) => {
          const isCheckedIn = p.checkedInAt != null || checkedInIds.has(p.id);
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{ minWidth: "800px", p: 3 }}
            >
              <Stack
                direction="row"
                spacing={3}
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="h5">
                    {p.title ? `${p.title} ` : ""}
                    {p.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <PhoneIcon sx={{ fontSize: 28 }} color="action" />
                    <Typography variant="h6" color="text.secondary">
                      {p.countryCode && p.phone
                        ? `${p.countryCode} ${maskPhone(p.phone)}`
                        : "(No phone number)"}
                    </Typography>
                  </Stack>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <EmailIcon sx={{ fontSize: 28 }} color="action" />
                    <Typography variant="h6" color="text.secondary">
                      {p.email ? maskEmail(p.email) : "(No email address)"}
                    </Typography>
                  </Stack>
                </Stack>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon sx={{ fontSize: 40 }} />}
                  onClick={() => handleCheckin(p.id)}
                  disabled={isCheckedIn || checkinMutation.isPending}
                  loading={
                    checkinMutation.isPending &&
                    checkinMutation.variables === p.id
                  }
                  sx={{ py: 1, px: 2, fontSize: "1.6rem", width: "230px" }}
                >
                  {isCheckedIn ? "Checked in" : "Check in"}
                </Button>
              </Stack>
            </Card>
          );
        })}
        <Box sx={{ mt: 2 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{
              fontSize: "1.2rem",
              borderColor: accentColor,
              color: accentColor,
              "&:hover": { borderColor: accentColor, color: accentColor },
            }}
          >
            Close ({countdown}s)
          </Button>
        </Box>
      </Stack>
    </Dialog>
  );
}
