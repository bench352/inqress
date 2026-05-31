import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
import { useAuth } from "../providers/useAuth";

interface SseChangeModeData {
  value: string;
}

interface SseControlCommandData {
  command: string;
  params: Record<string, unknown>;
}

interface SseRawEvent {
  eventType: string;
  type: string;
  data: SseChangeModeData | SseControlCommandData;
}

export interface ControlCommandEntry {
  command: string;
  params: Record<string, unknown>;
}

export interface UseBoothStreamReturn {
  mode: string | null;
  controlCommand: ControlCommandEntry | null;
  dismissCommand: () => void;
  connectionRejected: boolean;
}

export function useBoothStream(eventId: string): UseBoothStreamReturn {
  const { username, password } = useAuth();
  const stoppedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<string | null>(null);
  const [controlCommand, setControlCommand] =
    useState<ControlCommandEntry | null>(null);
  const [connectionRejected, setConnectionRejected] = useState(false);

  const dismissCommand = () => setControlCommand(null);

  useEffect(() => {
    if (!eventId || !username || !password) return;

    const token = btoa(`${username}:${password}`);
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const url = `${apiUrl}/api/events/${eventId}/checkInBooth/streams?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => console.log("[SSE Booth] connection opened");
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as SseRawEvent;
          handleMessage(parsed);
        } catch {
          console.error("[SSE Booth] parse error");
        }
      };

      es.onerror = () => {
        const rejected = es.readyState === EventSource.CLOSED;
        es.close();
        if (rejected) {
          setConnectionRejected(true);
        } else if (!stoppedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };
    };

    function handleMessage(ev: SseRawEvent) {
      if (ev.eventType === "CHANGE_MODE" && ev.type === "COMMAND") {
        const data = ev.data as SseChangeModeData;
        setMode(data.value);
      } else if (ev.eventType === "CONTROL" && ev.type === "COMMAND") {
        const data = ev.data as SseControlCommandData;
        setControlCommand({
          command: data.command,
          params: data.params ?? {},
        });
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

  return { mode, controlCommand, dismissCommand, connectionRejected };
}
