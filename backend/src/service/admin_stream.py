import asyncio
import logging
import threading

from schema.booth import BoothLifecycleStatus
from schema.sse import SseEvent, SseEventType

logger = logging.getLogger(__name__)


class AdminStreamManager:
    _instance: "AdminStreamManager | None" = None
    _instance_lock = threading.Lock()

    def __new__(cls) -> "AdminStreamManager":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    obj = super().__new__(cls)
                    obj._lock = threading.Lock()
                    obj._queues: list[asyncio.Queue] = []
                    obj._sticky: dict[str, SseEvent] = {}
                    cls._instance = obj
        return cls._instance

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

    def broadcast(self, event: SseEvent) -> None:
        with self._lock:
            if event.event_type == SseEventType.BOOTH_LIFECYCLE and hasattr(
                event.data, "event_id"
            ):
                key = f"booth_lifecycle:{event.data.event_id}"
                if event.data.status == BoothLifecycleStatus.CONNECTED:
                    self._sticky[key] = event
                elif event.data.status == BoothLifecycleStatus.DISCONNECTED:
                    self._sticky.pop(key, None)
            for q in self._queues:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass
