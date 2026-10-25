import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Card, Dialog, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EmailIcon from "@mui/icons-material/Email";
import GroupsIcon from "@mui/icons-material/Groups";
import PhoneIcon from "@mui/icons-material/Phone";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import successSound from "@/assets/soundEffects/checkin_success.aac";
import failSound from "@/assets/soundEffects/checkin_fail.aac";
import confirmSound from "@/assets/soundEffects/checkin_need_confirmation.aac";
import { useCompanionApi } from "@/api";
import { maskEmail, maskPhone } from "@/utils/masking";
import { useConfetti } from "@/hooks/useConfetti";
import { playSound } from "../sounds";
import type { ConflictParticipant } from "./types";

const INITIAL_TIMEOUT_S = 60;
const ALL_DONE_TIMEOUT_S = 5;

interface Props {
  open: boolean;
  eventId: string;
  accentColor: string;
  participants: ConflictParticipant[];
  onClose: () => void;
}

export default function ConflictPickerDialog({
  open,
  eventId,
  accentColor,
  participants,
  onClose,
}: Props) {
  const api = useCompanionApi();
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const { fire: fireConfetti } = useConfetti();
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
    if (open) playSound(confirmSound);
  }, [open]);

  const handleCheckin = useCallback(
    async (participantId: string) => {
      setPendingId(participantId);
      setErrorById((prev) => {
        if (!(participantId in prev)) return prev;
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      try {
        const data = await api.post<{
          success: boolean;
          detail: { reason?: string } | Record<string, unknown>;
        }>(`/api/events/${eventId}/companion/checkin/manual`, {
          participantId,
        });
        if (!data.success) {
          throw new Error(
            "reason" in data.detail && typeof data.detail.reason === "string"
              ? data.detail.reason
              : "Check-in failed",
          );
        }
        setCheckedInIds((prev) => new Set(prev).add(participantId));
        playSound(successSound);
        fireConfetti();
        countdownRef.current = INITIAL_TIMEOUT_S;
        setCountdown(INITIAL_TIMEOUT_S);
      } catch (e: unknown) {
        // keep the picker open; guest can try another entry or Close
        playSound(failSound);
        const detail =
          e && typeof e === "object" && "detail" in e
            ? (e as { detail: unknown }).detail
            : null;
        setErrorById((prev) => ({
          ...prev,
          [participantId]:
            typeof detail === "string" ? detail : "Check-in failed",
        }));
      } finally {
        setPendingId(null);
      }
    },
    [api, eventId, fireConfetti],
  );

  return (
    <Dialog open={open} scroll="body" fullScreen>
      <Stack
        direction="column"
        spacing={3}
        sx={{
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          p: 4,
        }}
      >
        <GroupsIcon sx={{ fontSize: 96, color: accentColor }} />
        <Typography variant="h3" sx={{ fontWeight: 500 }}>
          Multiple participants found
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "center" }}
        >
          <TouchAppOutlinedIcon fontSize="medium" />
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            Tap &quot;Check in&quot; for the correct participants on the screen
          </Typography>
        </Stack>

        {participants.map((p) => {
          const isCheckedIn = p.checkedInAt != null || checkedInIds.has(p.id);
          return (
            <Card
              key={p.id}
              variant="outlined"
              sx={{ width: "100%", maxWidth: 900, p: 3 }}
            >
              <Stack
                direction="row"
                spacing={3}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Stack spacing={1}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    {p.title ? `${p.title} ` : ""}
                    {p.name}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <PhoneIcon sx={{ fontSize: 28 }} color="action" />
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
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
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {p.email ? maskEmail(p.email) : "(No email address)"}
                    </Typography>
                  </Stack>
                </Stack>
                {errorById[p.id] && (
                  <Typography color="error" sx={{ mt: 1, fontWeight: 500 }}>
                    {errorById[p.id]}
                  </Typography>
                )}
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon sx={{ fontSize: 32 }} />}
                  onClick={() => handleCheckin(p.id)}
                  disabled={isCheckedIn || pendingId !== null}
                  loading={pendingId === p.id}
                  sx={{ py: 1, px: 2, fontSize: "1.3rem", width: 220 }}
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
