import logging
import queue
import threading
import uuid

import schema.sse

logger = logging.getLogger(__name__)


class CompanionStreamManager:
    """Multi-connection per event, tagged by mode (kiosk|scanner).
    Re-verification of token happens at the HTTP layer on connect/heartbeat.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # event_id -> list of (queue, mode)
        self._connections: dict[uuid.UUID, list[tuple[queue.Queue, str]]] = {}
        self._sticky: dict[uuid.UUID, dict[str, schema.sse.SseEvent]] = {}

    def subscribe(self, event_id: uuid.UUID, mode: str) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self._lock:
            self._connections.setdefault(event_id, []).append((q, mode))
            for ev in self._sticky.get(event_id, {}).values():
                q.put_nowait(ev)
        return q

    def unsubscribe(self, event_id: uuid.UUID, q: queue.Queue) -> None:
        with self._lock:
            conns = self._connections.get(event_id, [])
            self._connections[event_id] = [(qq, m) for qq, m in conns if qq is not q]
            if not self._connections.get(event_id):
                self._connections.pop(event_id, None)
                self._sticky.pop(event_id, None)

    def send(
        self,
        event_id: uuid.UUID,
        event: schema.sse.SseEvent,
        *,
        modes: set[str] | None = None,
        sticky: bool = False,
    ) -> int:
        """Send to connections. If modes given, only those. Returns count sent to."""
        sent = 0
        with self._lock:
            if sticky:
                self._sticky.setdefault(event_id, {})[event.event_type] = event
            conns = self._connections.get(event_id, [])
            for q, m in conns:
                if modes is None or m in modes:
                    try:
                        q.put_nowait(event)
                        sent += 1
                    except queue.Full:
                        pass
        return sent

    def close_all(self, event_id: uuid.UUID) -> None:
        """Terminate every subscriber for the event (e.g. on token rotate).

        Pushes a None sentinel into each queue; the SSE generator in the API
        layer breaks on it and unsubscribes itself.
        """
        with self._lock:
            for q, _mode in self._connections.get(event_id, []):
                try:
                    q.put_nowait(None)
                except queue.Full:
                    pass

    def count(self, event_id: uuid.UUID, mode: str | None = None) -> int:
        with self._lock:
            conns = self._connections.get(event_id, [])
            if mode is None:
                return len(conns)
            return sum(1 for _, m in conns if m == mode)

    def get_modes_counts(self, event_id: uuid.UUID) -> tuple[int, int]:
        with self._lock:
            conns = self._connections.get(event_id, [])
            kiosks = sum(1 for _, m in conns if m == "kiosk")
            scanners = sum(1 for _, m in conns if m == "scanner")
            return kiosks, scanners


companion_stream_manager = CompanionStreamManager()
