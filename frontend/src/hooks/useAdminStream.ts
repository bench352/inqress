import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";
import { useAuth } from "../providers/useAuth";

interface BoothLifecycleData {
  eventId: string;
  eventName: string;
  status: "connected" | "disconnected";
}

interface SseRawEvent {
  eventType: string;
  type: string;
  data: BoothLifecycleData;
}

export interface ActiveBooth {
  eventId: string;
  eventName: string;
}

export interface UseAdminStreamReturn {
  activeBooths: ActiveBooth[];
}

export function useAdminStream(): UseAdminStreamReturn {
  const { username, password } = useAuth();
  const stoppedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeBooths, setActiveBooths] = useState<ActiveBooth[]>([]);

  useEffect(() => {
    if (!username || !password) return;

    const token = btoa(`${username}:${password}`);
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const url = `${apiUrl}/api/admin/streams?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => console.log("[SSE Admin] connection opened");
      es.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as SseRawEvent;
          handleMessage(parsed);
        } catch {
          console.error("[SSE Admin] parse error");
        }
      };

      es.onerror = () => {
        console.log("[SSE Admin] error, reconnecting in 3s");
        es.close();
        if (!stoppedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 3000);
        }
      };
    };

    function handleMessage(ev: SseRawEvent) {
      if (ev.eventType === "BOOTH_LIFECYCLE" && ev.type === "NOTIFICATION") {
        const data = ev.data as BoothLifecycleData;
        if (data.status === "connected") {
          setActiveBooths((prev) => {
            if (prev.some((b) => b.eventId === data.eventId)) return prev;
            return [
              ...prev,
              { eventId: data.eventId, eventName: data.eventName },
            ];
          });
        } else if (data.status === "disconnected") {
          setActiveBooths((prev) =>
            prev.filter((b) => b.eventId !== data.eventId),
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
  }, [username, password]);

  return { activeBooths };
}
