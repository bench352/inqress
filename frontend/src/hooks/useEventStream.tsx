import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { apiUrl } from "../api";
import { useAuth } from "../providers/useAuth";

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
  attendeeId: string;
  title: string;
  name: string;
  checkInMethod: string;
  checkInAt: string;
}

interface SseRawEvent {
  eventType: string;
  type: string;
  data: SseProgressData | SseSuccessData | SseErrorData | SseAttendanceData;
}

export interface AttendanceDialogEntry {
  attendeeId: string;
  title: string;
  name: string;
  checkInMethod: string;
  checkInAt: string;
}

export interface UseEventStreamReturn {
  createAttendeeProgress: ProgressState | null;
  sendEmailProgress: ProgressState | null;
  generateTicketQrProgress: ProgressState | null;
  resultDialog: { resultId: string; expireOn: string } | null;
  dismissResultDialog: () => void;
  attendanceDialog: AttendanceDialogEntry | null;
  dismissAttendanceDialog: () => void;
}

export function useEventStream(
  eventId: string,
  queryClient: QueryClient,
): UseEventStreamReturn {
  const { username, password } = useAuth();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const stoppedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClientRef = useRef(queryClient);
  const enqueueSnackbarRef = useRef(enqueueSnackbar);
  const closeSnackbarRef = useRef(closeSnackbar);

  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  useEffect(() => {
    enqueueSnackbarRef.current = enqueueSnackbar;
  }, [enqueueSnackbar]);

  useEffect(() => {
    closeSnackbarRef.current = closeSnackbar;
  }, [closeSnackbar]);

  const [createAttendeeProgress, setCreateAttendeeProgress] =
    useState<ProgressState | null>(null);
  const [sendEmailProgress, setSendEmailProgress] =
    useState<ProgressState | null>(null);
  const [generateTicketQrProgress, setGenerateTicketQrProgress] =
    useState<ProgressState | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    resultId: string;
    expireOn: string;
  } | null>(null);
  const [attendanceDialog, setAttendanceDialog] =
    useState<AttendanceDialogEntry | null>(null);

  const dismissResultDialog = useCallback(() => {
    setResultDialog(null);
  }, []);

  const dismissAttendanceDialog = useCallback(() => {
    setAttendanceDialog(null);
  }, []);

  useEffect(() => {
    if (!eventId || !username || !password) return;

    const token = btoa(`${username}:${password}`);
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const url = `${apiUrl}/api/events/${eventId}/streams?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
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
        console.log("[SSE] error, reconnecting in 3s");
        es.close();
        if (!stoppedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
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

      const handleNotificationSuccess = (
        message: string,
        resultId?: string,
        expireOn?: string,
      ) => {
        if (resultId && expireOn) {
          enqueueSnackbarRef.current(message, {
            variant: "success",
            action: (key) => (
              <Button
                size="small"
                sx={{ color: "white" }}
                onClick={() => {
                  setResultDialog({ resultId, expireOn });
                  closeSnackbarRef.current(key);
                }}
              >
                View Result
              </Button>
            ),
          });
        } else {
          enqueueSnackbarRef.current(message, { variant: "success" });
        }
        queryClientRef.current.invalidateQueries({
          queryKey: ["attendees", eventId],
        });
      };

      const handleNotificationError = (message: string) => {
        enqueueSnackbarRef.current(message, { variant: "error" });
        queryClientRef.current.invalidateQueries({
          queryKey: ["attendees", eventId],
        });
      };

      if (ev.eventType === "CREATE_ATTENDEE") {
        if (ev.type === "PROGRESS") {
          const data = ev.data as SseProgressData;
          handleProgress(data, setCreateAttendeeProgress);
        } else if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseSuccessData | SseErrorData;
          if (data.type === "success") {
            const successData = data as SseSuccessData;
            handleNotificationSuccess(
              "Attendee import completed",
              successData.resultId,
              successData.expireOn,
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
      } else if (ev.eventType === "ATTENDANCE") {
        if (ev.type === "NOTIFICATION") {
          const data = ev.data as SseAttendanceData;
          queryClientRef.current.setQueryData(
            ["attendees", eventId],
            (old: object[] | undefined) => {
              if (!old) return old;
              return (
                old as Array<{ id: string; checkedInAt: string | null }>
              ).map((a) =>
                a.id === data.attendeeId
                  ? { ...a, checkedInAt: data.checkInAt }
                  : a,
              );
            },
          );
          setAttendanceDialog({
            attendeeId: data.attendeeId,
            title: data.title,
            name: data.name,
            checkInMethod: data.checkInMethod,
            checkInAt: data.checkInAt,
          });
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
  }, [eventId, username, password]);

  return {
    createAttendeeProgress,
    sendEmailProgress,
    generateTicketQrProgress,
    resultDialog,
    dismissResultDialog,
    attendanceDialog,
    dismissAttendanceDialog,
  };
}
