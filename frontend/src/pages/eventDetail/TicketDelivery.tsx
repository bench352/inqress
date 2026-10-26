import { useState } from "react";
import {
  Alert,
  Button,
  Divider,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import OutgoingMailIcon from "@mui/icons-material/OutgoingMail";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useSnackbar } from "notistack";
import { ApiError, useApi } from "@/api";
import PageHeader from "@/components/PageHeader";
import SectionHeading from "@/components/SectionHeading";
import { useAppInfo } from "@/providers/useAppInfo";
import type { EventItem } from "../eventsList/useEvents";
import MessageTemplateEditor from "./components/MessageTemplateEditor";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu";

interface EmailSettings {
  subject: string | null;
  senderName: string | null;
}

function errorDetail(error: unknown): string {
  const detail =
    error instanceof ApiError
      ? String(error.detail)
      : "Could not reach the server";
  return detail.replace(/\.$/, "") + ".";
}

export default function TicketDelivery() {
  const { eventId } = useParams({
    from: "/app-shell/admin/events/$eventId/ticketDelivery",
  });
  const navigate = useNavigate();
  const api = useApi();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { orgName, emailFooterEnabled } = useAppInfo();

  const [senderDraft, setSenderDraft] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const eventQuery = useQuery<EventItem>({
    queryKey: ["event", eventId],
    queryFn: () => api.get(`/api/events/${eventId}`),
    enabled: !!eventId,
  });
  const settingsQuery = useQuery<EmailSettings>({
    queryKey: ["emailSettings", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/emailSettings`),
    enabled: !!eventId,
  });
  const templateQuery = useQuery<{ text: string }>({
    queryKey: ["emailTemplate", eventId],
    queryFn: () => api.get(`/api/events/${eventId}/emailTemplate`),
    enabled: !!eventId,
  });

  const senderName = senderDraft ?? settingsQuery.data?.senderName ?? "";
  const subject = subjectDraft ?? settingsQuery.data?.subject ?? "";
  const templateText = templateDraft ?? templateQuery.data?.text ?? "";
  const ready =
    settingsQuery.data !== undefined && templateQuery.data !== undefined;

  const handleSave = async () => {
    const cleanSenderName = senderName.trim() || null;
    const cleanSubject = subject.trim() || null;
    setSaving(true);
    setSaveError(null);

    const results = await Promise.allSettled([
      api.put(`/api/events/${eventId}/emailSettings`, {
        subject: cleanSubject,
        senderName: cleanSenderName,
      }),
      api.put(`/api/events/${eventId}/emailTemplate`, { text: templateText }),
    ]);

    const failures: string[] = [];
    const [settingsResult, templateResult] = results;

    if (settingsResult.status === "fulfilled") {
      setSenderDraft(cleanSenderName);
      setSubjectDraft(cleanSubject);
      void queryClient.invalidateQueries({
        queryKey: ["emailSettings", eventId],
      });
    } else {
      failures.push(`Email delivery: ${errorDetail(settingsResult.reason)}`);
    }

    if (templateResult.status === "fulfilled") {
      setTemplateDraft(templateText);
      void queryClient.invalidateQueries({
        queryKey: ["emailTemplate", eventId],
      });
    } else {
      failures.push(`Message template: ${errorDetail(templateResult.reason)}`);
    }

    if (failures.length > 0) {
      const savedSome = results.some((result) => result.status === "fulfilled");
      setSaveError(
        `Some settings were not saved. ${failures.join(" ")} ${
          savedSome ? "The other settings were saved." : "Nothing was saved."
        }`,
      );
    } else {
      enqueueSnackbar("Ticket delivery settings saved.", {
        variant: "success",
      });
    }
    setSaving(false);
  };

  if (
    eventQuery.isLoading ||
    settingsQuery.isLoading ||
    templateQuery.isLoading
  ) {
    return <LinearProgress />;
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      <PageHeader
        title="Ticket delivery"
        subtitle={eventQuery.data?.name}
        onBack={() =>
          navigate({
            to: "/admin/events/$eventId/settings",
            params: { eventId },
          })
        }
      />

      <SectionHeading icon={<OutgoingMailIcon />}>
        Email behavior
      </SectionHeading>
      {settingsQuery.data ? (
        <Stack spacing={2}>
          <Typography variant="body1">
            Customize how email ticket delivery works. Leave blank to use
            default value shown.
          </Typography>
          <TextField
            label="Sender name"
            value={senderName}
            onChange={(event) => setSenderDraft(event.target.value)}
            placeholder={orgName || "Event Organizer"}
            fullWidth
            disabled={saving}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { maxLength: 200 },
            }}
          />
          <TextField
            label="Subject line"
            value={subject}
            onChange={(event) => setSubjectDraft(event.target.value)}
            placeholder={`[Ticket] ${eventQuery.data?.name ?? ""}`}
            fullWidth
            disabled={saving}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { maxLength: 200 },
            }}
          />
        </Stack>
      ) : (
        <Alert severity="error">
          Could not load the email settings. Refresh to try again.
        </Alert>
      )}

      <Divider />

      <SectionHeading icon={<HistoryEduIcon />}>
        Message template
      </SectionHeading>
      {templateQuery.data ? (
        <>
          <Typography variant="body1">
            Write the message that is delivered alongside every ticket. Use{" "}
            <strong>[+ Field]</strong> to include key information into the
            template.
            {emailFooterEnabled &&
              " (A short InQRess footer is also added when this is sent by email.)"}
          </Typography>
          <MessageTemplateEditor
            initialText={templateQuery.data.text}
            onChange={setTemplateDraft}
          />
        </>
      ) : (
        <Alert severity="error">
          Could not load the message template. Refresh to try again.
        </Alert>
      )}

      {saveError && <Alert severity="error">{saveError}</Alert>}

      <Button
        variant="contained"
        startIcon={<SaveIcon />}
        onClick={handleSave}
        loading={saving}
        disabled={!ready}
        sx={{ alignSelf: "flex-start" }}
      >
        Save
      </Button>
    </Stack>
  );
}
