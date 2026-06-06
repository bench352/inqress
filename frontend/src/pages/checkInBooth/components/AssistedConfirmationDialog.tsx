import { useState } from "react";
import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import EmailIcon from "@mui/icons-material/Email";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import PhoneIcon from "@mui/icons-material/Phone";
import { maskEmail, maskPhone } from "@/utils/masking";
import { useApi } from "../../../api";
import CheckinResultDisplay from "./CheckinResultDisplay";
import type { CheckinPhase, CheckinResponse } from "../types";

interface Props {
  open: boolean;
  eventId: string;
  participantId: string;
  title: string | null;
  name: string;
  countryCode: string | null;
  phone: string | null;
  email: string | null;
  onClose: () => void;
}

export default function AssistedConfirmationDialog({
  open,
  eventId,
  participantId,
  title,
  name,
  countryCode,
  phone,
  email,
  onClose,
}: Props) {
  const api = useApi();
  const [phase, setPhase] = useState<CheckinPhase>("idle");
  const [result, setResult] = useState<CheckinResponse | null>(null);

  const handleYes = () => {
    setPhase("loading");
    api
      .post<CheckinResponse>(`/api/events/${eventId}/checkin/manual`, {
        participantId,
      })
      .then((data) => {
        setResult(data);
        setPhase(data.success ? "success" : "error");
      })
      .catch((err) => {
        setResult({
          success: false,
          detail: { reason: err.message || "Check-in failed" },
        });
        setPhase("error");
      });
  };

  if (!open) return null;

  if (phase !== "idle") {
    return (
      <Dialog open fullScreen>
        <CheckinResultDisplay
          phase={phase}
          result={result}
          onDismiss={onClose}
        />
      </Dialog>
    );
  }

  return (
    <Dialog open fullScreen>
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          p: 8,
        }}
      >
        <PersonSearchIcon sx={{ fontSize: 120, color: "primary.main" }} />
        <Typography variant="h2" color="text.secondary">
          Confirm this is you
        </Typography>
        <Typography variant="h1" color="text.secondary">
          {title ? `${title} ` : ""}
          {name}
        </Typography>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <PhoneIcon fontSize="large" color="action" />
            <Typography variant="h4" color="text.secondary">
              {countryCode && phone
                ? `${countryCode} ${maskPhone(phone)}`
                : "(No phone number)"}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <EmailIcon fontSize="large" color="action" />
            <Typography variant="h4" color="text.secondary">
              {email ? maskEmail(email) : "(No email address)"}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={4} sx={{ mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            color="error"
            onClick={onClose}
            startIcon={<CancelIcon />}
            sx={{ py: 2, px: 4, fontSize: "2rem", width: "300px" }}
          >
            No
          </Button>
          <Button
            variant="contained"
            size="large"
            color="success"
            onClick={handleYes}
            startIcon={<CheckCircleIcon />}
            sx={{ py: 2, px: 4, fontSize: "2rem", width: "300px" }}
          >
            Yes
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
