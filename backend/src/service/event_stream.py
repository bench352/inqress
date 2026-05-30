import datetime
import logging
import queue
import threading
import uuid

from schema.rest import BulkCreateResponse
from schema.sse import SseEvent, SseEventType, SseType

logger = logging.getLogger(__name__)


class EventStreamManager:
    _instance: "EventStreamManager | None" = None
    _instance_lock = threading.Lock()

    def __new__(cls) -> "EventStreamManager":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    obj = super().__new__(cls)
                    obj._lock = threading.Lock()
                    obj._queues: dict[uuid.UUID, list[queue.Queue]] = {}
                    obj._sticky: dict[uuid.UUID, dict[SseEventType, SseEvent]] = {}
                    obj._active_jobs: dict[uuid.UUID, set[str]] = {}
                    obj._results: dict[uuid.UUID, tuple[datetime.datetime, object]] = {}
                    cls._instance = obj
        return cls._instance

    def subscribe(self, event_id: uuid.UUID) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self._lock:
            self._queues.setdefault(event_id, []).append(q)
            for event in self._sticky.get(event_id, {}).values():
                q.put(event)
        return q

    def unsubscribe(self, event_id: uuid.UUID, q: queue.Queue) -> None:
        with self._lock:
            try:
                self._queues.get(event_id, []).remove(q)
            except KeyError, ValueError:
                pass

    def send(
        self, event_id: uuid.UUID, event: SseEvent, *, sticky: bool = False
    ) -> None:
        with self._lock:
            if sticky:
                self._sticky.setdefault(event_id, {})[event.event_type] = event
            if (
                event.type == SseType.PROGRESS
                and hasattr(event.data, "in_progress")
                and not event.data.in_progress
            ):
                self._sticky.get(event_id, {}).pop(event.event_type, None)
            for q in self._queues.get(event_id, []):
                try:
                    q.put_nowait(event)
                except queue.Full:
                    pass

    def is_job_active(self, event_id: uuid.UUID, job_type: str) -> bool:
        with self._lock:
            return job_type in self._active_jobs.get(event_id, set())

    def mark_job_active(self, event_id: uuid.UUID, job_type: str) -> bool:
        with self._lock:
            jobs = self._active_jobs.setdefault(event_id, set())
            if job_type in jobs:
                return False
            jobs.add(job_type)
            return True

    def mark_job_done(self, event_id: uuid.UUID, job_type: str) -> None:
        with self._lock:
            self._active_jobs.get(event_id, set()).discard(job_type)

    def store_result(
        self,
        result_id: uuid.UUID,
        data: BulkCreateResponse,
        ttl_minutes: int = 30,
    ) -> None:
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=ttl_minutes)
        with self._lock:
            self._results[result_id] = (expiry, data)
        threading.Timer(
            ttl_minutes * 60, self._cleanup_result, args=(result_id,)
        ).start()

    def get_result(self, result_id: uuid.UUID) -> BulkCreateResponse | None:
        with self._lock:
            entry = self._results.get(result_id)
            if entry is None:
                return None
            expiry, data = entry
            if datetime.datetime.now() > expiry:
                del self._results[result_id]
                return None
            return data

    def _cleanup_result(self, result_id: uuid.UUID) -> None:
        with self._lock:
            self._results.pop(result_id, None)
