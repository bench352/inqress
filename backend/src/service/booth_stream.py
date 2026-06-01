import logging
import queue
import threading
import uuid

from schema.sse import SseEvent

logger = logging.getLogger(__name__)


class BoothAlreadyConnected(Exception):
    pass


class BoothStreamManager:
    _instance: "BoothStreamManager | None" = None
    _instance_lock = threading.Lock()

    def __new__(cls) -> "BoothStreamManager":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    obj = super().__new__(cls)
                    obj._lock = threading.Lock()
                    obj._queues: dict[uuid.UUID, queue.Queue] = {}
                    obj._sticky: dict[uuid.UUID, dict[str, SseEvent]] = {}
                    cls._instance = obj
        return cls._instance

    def subscribe(self, event_id: uuid.UUID) -> queue.Queue:
        with self._lock:
            if event_id in self._queues:
                raise BoothAlreadyConnected(
                    f"Booth already connected for event {event_id}"
                )
            q: queue.Queue = queue.Queue()
            self._queues[event_id] = q
            for event in self._sticky.get(event_id, {}).values():
                q.put_nowait(event)
            return q

    def unsubscribe(self, event_id: uuid.UUID) -> None:
        with self._lock:
            self._queues.pop(event_id, None)
            self._sticky.pop(event_id, None)

    def send(
        self, event_id: uuid.UUID, event: SseEvent, *, sticky: bool = False
    ) -> bool:
        with self._lock:
            if sticky:
                self._sticky.setdefault(event_id, {})[event.event_type] = event
            q = self._queues.get(event_id)
            if q is not None:
                try:
                    q.put_nowait(event)
                    return True
                except queue.Full:
                    pass
            return False

    def is_connected(self, event_id: uuid.UUID) -> bool:
        with self._lock:
            return event_id in self._queues

    def get_active_booths(self) -> list[uuid.UUID]:
        with self._lock:
            return list(self._queues.keys())
