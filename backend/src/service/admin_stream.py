import asyncio
import logging
import threading

import schema.booth
import schema.sse

logger = logging.getLogger(__name__)


class AdminStreamManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._queues: list[asyncio.Queue] = []
        self._sticky: dict[str, schema.sse.SseEvent] = {}

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._queues.append(q)
            for event in self._sticky.values():
                q.put_nowait(event)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            try:
                self._queues.remove(q)
            except ValueError:
                pass

    def broadcast(self, event: schema.sse.SseEvent) -> None:
        with self._lock:
            if event.event_type == schema.sse.SseEventType.BOOTH_LIFECYCLE and hasattr(
                event.data, "event_id"
            ):
                key = f"booth_lifecycle:{event.data.event_id}"
                if event.data.status == schema.booth.BoothLifecycleStatus.CONNECTED:
                    self._sticky[key] = event
                elif (
                    event.data.status == schema.booth.BoothLifecycleStatus.DISCONNECTED
                ):
                    self._sticky.pop(key, None)
            for q in self._queues:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass


admin_stream_manager = AdminStreamManager()
