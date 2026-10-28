import { useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import LaunchIcon from "@mui/icons-material/Launch";
import type { QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSnackbar, type SnackbarKey } from "notistack";
import { apiUrl, sessionStatus } from "../api";
import { redirectToLogin } from "../providers/redirectToLogin";
import { useAuth } from "../providers/useAuth";
import type { DataSourceSyncState } from "../providers/useDataSourceSync";
import { summaryParts } from "../pages/dataSources/types";

interface ProgressState {
  inProgress: boolean;
  numCompleted: number;
  numTotal: number;
  estRemainMin: number | null;
  numErrors: number;
}

interface SseProgressData {
  inProgress: boolean;
  numCompleted: number;
  numTotal: number;
  estRemainMin: number | null;
  numErrors: number;
}

interface SseSuccessData {
  type: string;
  expireOn?: string;
  resultId?: string;
}

interface SseErrorData {
  type: string;
  detail: string;
}

interface SseAttendanceData {
  participantId: string;
  title: string | null;
  name: string;
  checkInMethod: string;
  checkInAt: string;
}

interface SseDataSourceSyncData {
  sourceId: string;
  sourceName: string;
  inProgress: boolean;
  added: number;
  updated: number;
  skipped: number;
  errors: number;
  errorSamples: string[];
  detail: string | null;
}

interface SseRawEvent {
  eventType: string;
  type: string;
  data:
    | SseProgressData
    | SseSuccessData
    | SseErrorData
    | SseAttendanceData
    | SseDataSourceSyncData;
}

export interface UseEventStreamReturn {
  createParticipantProgress: ProgressState | null;
  sendEmailProgress: ProgressState | null;
  generateTicketQrProgress: ProgressState | null;
  resultDialog: { resultId: string } | null;
  dismissResultDialog: () => void;
  dataSourceSync: DataSourceSyncState | null;
}

export function useEventStream(
  eventId: string,
  queryClient: QueryClient,
): UseEventStreamReturn {
  const { isAuthenticated } = useAuth();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const stoppedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClientRef = useRef(queryClient);
  const enqueueSnackbarRef = useRef(enqueueSnackbar);
  const closeSnackbarRef = useRef(closeSnackbar);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  useEffect(() => {
    enqueueSnackbarRef.current = enqueueSnackbar;
  }, [enqueueSnackbar]);

  useEffect(() => {
    closeSnackbarRef.current = closeSnackbar;
  }, [closeSnackbar]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const [createParticipantProgress, setCreateParticipantProgress] =
    useState<ProgressState | null>(null);
  const [sendEmailProgress, setSendEmailProgress] =
    useState<ProgressState | null>(null);
  const [generateTicketQrProgress, setGenerateTicketQrProgress] =
    useState<ProgressState | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    resultId: string;
  } | null>(null);
  const [dataSourceSync, setDataSourceSync] =
    useState<DataSourceSyncState | null>(null);

  const dismissResultDialog = useCallback(() => {
    setResultDialog(null);
  }, []);

  useEffect(() => {
    if (!eventId || !isAuthenticated) return;

    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const url = `${apiUrl}/api/events/${eventId}/streams`;
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => console.log("[SSE] connection opened");
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as SseRawEvent;
          handleMessage(parsed);
        } catch (err) {
          console.error("[SSE] parse error:", err);
        }
      };

      es.onerror = () => {
        es.close();
        if (stoppedRef.current) return;
        void (async () => {
          const status = await sessionStatus();
          if (status === 401) {
            stoppedRef.current = true;
            redirectToLogin();
            return;
          }
          console.log("[SSE] error, reconnecting in 3s");
          if (!stoppedRef.current) {
            reconnectTimerRef.current = setTimeout(connect, 3000);
          }
        })();
      };
    };

    function handleMessage(ev: SseRawEvent) {
      const handleProgress = <T extends SseProgressData>(
        data: T,
        setProgressFn: React.Dispatch<
          React.SetStateAction<ProgressState | null>
        >,
      ) => {
        setProgressFn({
          inProgress: data.inProgress,
          numCompleted: data.numCompleted,
          numTotal: data.numTotal,
          estRemainMin: data.estRemainMin ?? null,
          numErrors: data.numErrors ?? 0,
        });
      };

      /** Icon-only action: the label stays as the tooltip and the accessible name. */
      const toastAction = (label: string, onClick: () => void) => (
        <Tooltip title={label}>
          <IconButton
            size="small"
            color="inherit"
            aria-label={label}
            onClick={onClick}
          >
            <LaunchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );

      const handleNotificationSuccess = (
        message: string,
        resultId?: string,
      ) => {
        if (resultId) {
          enqueueSnackbarRef.current(message, {
            variant: "success",
            action: (key) =>
              toastAction("View result", () => {
                setResultDialog({ resultId });
                closeSnackbarRef.current(key);
              }),
          });
        } else {
          enqueueSnackbarRef.current(message, { variant: "success" });
        }
        queryClientRef.current.invalidateQueries({
          queryKey: ["participants", eventId],
        });
      };

      const handleNotificationError = (message: string) => {
        enqueueSnackbarRef.current(message, { variant: "error" });
        queryClientRef.current.invalidateQueries({
          queryKey: ["participants", eventId],
        });
      };

      /** Two lines read better than one long sentence on a sync failure. */
      const syncToast = (title: string, body: string) => (
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body1">{body}</Typography>
        </Box>
      );

      const sourceAction =
        (sourceId: string | null, label: string) => (key: SnackbarKey) =>
          toastAction(label, () => {
            void navigateRef.current({
              to: "/admin/events/$eventId/dataSources",
              params: { eventId },
              search: sourceId ? { syncErrors: sourceId } : {},
            });
            closeSnackbarRef.current(key);
          });

      if (ev.eventType === "CREATE_PARTICIPANT") {
        if (ev.type === "PROGRESS") {
          const data = ev.data as SseProgressData;
          handleProgress(data, setCreateParticipantProgress);
        } else if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseSuccessData | SseErrorData;
          if (data.type === "success") {
            const successData = data as SseSuccessData;
            handleNotificationSuccess(
              "Participant import completed",
              successData.resultId,
            );
          } else if (data.type === "error") {
            const errorData = data as SseErrorData;
            handleNotificationError(
              `Import failed: ${errorData.detail || "Unknown error"}`,
            );
          }
        }
      } else if (ev.eventType === "SEND_EMAIL") {
        if (ev.type === "PROGRESS") {
          const data = ev.data as SseProgressData;
          handleProgress(data, setSendEmailProgress);
        } else if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseSuccessData | SseErrorData;
          if (data.type === "success") {
            handleNotificationSuccess("Bulk email sending completed");
          } else if (data.type === "error") {
            const errorData = data as SseErrorData;
            handleNotificationError(
              `Email sending failed: ${errorData.detail || "Unknown error"}`,
            );
          }
        }
      } else if (ev.eventType === "GENERATE_TICKET_QR") {
        if (ev.type === "PROGRESS") {
          const data = ev.data as SseProgressData;
          handleProgress(data, setGenerateTicketQrProgress);
        } else if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseSuccessData | SseErrorData;
          if (data.type === "success") {
            handleNotificationSuccess("Ticket QR generation completed");
          } else if (data.type === "error") {
            const errorData = data as SseErrorData;
            handleNotificationError(
              `Ticket QR generation failed: ${errorData.detail || "Unknown error"}`,
            );
          }
        }
      } else if (ev.eventType === "DATA_SOURCE_SYNC") {
        const data = ev.data as SseDataSourceSyncData;
        if (data.inProgress) {
          // A page opened mid-sync still sees it: the backend keeps this event while it runs.
          setDataSourceSync({
            sourceId: data.sourceId,
            sourceName: data.sourceName,
          });
          // Fetch the list now: a tab that has not listed this source yet needs its
          // card on screen to show the sync in progress.
          queryClientRef.current.invalidateQueries({
            queryKey: ["dataSources", eventId],
          });
        } else {
          setDataSourceSync(null);
          queryClientRef.current.invalidateQueries({
            queryKey: ["participants", eventId],
          });
          queryClientRef.current.invalidateQueries({
            queryKey: ["dataSources", eventId],
          });
          // shortcut: one toast per changed source per cycle, no batching; batch them
          // if a deployment ever runs many chatty sources.
          if (data.detail) {
            enqueueSnackbarRef.current(
              syncToast(`${data.sourceName} — sync failed`, data.detail),
              { variant: "error", action: sourceAction(null, "View") },
            );
          } else if (data.added > 0 || data.updated > 0 || data.errors > 0) {
            const parts = summaryParts(data);
            if (data.errors > 0) {
              const first = data.errorSamples[0];
              const more = data.errorSamples.length - 1;
              enqueueSnackbarRef.current(
                syncToast(
                  `${data.sourceName} — some participant records could not be synced`,
                  first
                    ? `${parts.join(", ")}. ${first}${more > 0 ? ` and ${more} more` : ""}`
                    : parts.join(", "),
                ),
                {
                  variant: "warning",
                  action: sourceAction(data.sourceId, "View errors"),
                },
              );
            } else {
              enqueueSnackbarRef.current(
                `${data.sourceName}: ${parts.join(", ")}`,
                { variant: "success" },
              );
            }
          }
        }
      } else if (ev.eventType === "ATTENDANCE") {
        if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseAttendanceData;
          queryClientRef.current.setQueryData(
            ["participants", eventId],
            (old: object[] | undefined) => {
              if (!old) return old;
              return (
                old as Array<{ id: string; checkedInAt: string | null }>
              ).map((a) =>
                a.id === data.participantId
                  ? { ...a, checkedInAt: data.checkInAt }
                  : a,
              );
            },
          );
          enqueueSnackbarRef.current(
            `${data.title ? data.title + " " : ""}${data.name} checked in`,
            { variant: "success" },
          );
        }
      }
    }

    connect();

    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [eventId, isAuthenticated]);

  return {
    createParticipantProgress,
    sendEmailProgress,
    generateTicketQrProgress,
    resultDialog,
    dismissResultDialog,
    dataSourceSync,
  };
}
