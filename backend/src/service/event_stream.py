import datetime
import logging
import queue
import threading
import uuid

import schema.rest
import schema.sse

logger = logging.getLogger(__name__)


class EventStreamManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._queues: dict[uuid.UUID, list[queue.Queue]] = {}
        self._sticky: dict[
            uuid.UUID, dict[schema.sse.SseEventType, schema.sse.SseEvent]
        ] = {}
        self._active_jobs: dict[uuid.UUID, set[str]] = {}
        self._results: dict[
            uuid.UUID, tuple[datetime.datetime, schema.rest.BulkCreateResponse]
        ] = {}

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
        self, event_id: uuid.UUID, event: schema.sse.SseEvent, *, sticky: bool = False
    ) -> None:
        with self._lock:
            if sticky:
                self._sticky.setdefault(event_id, {})[event.event_type] = event
            if (
                event.type == schema.sse.SseType.PROGRESS
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
        data: schema.rest.BulkCreateResponse,
        ttl_minutes: int = 30,
    ) -> None:
        expiry = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            minutes=ttl_minutes
        )
        with self._lock:
            self._results[result_id] = (expiry, data)
        threading.Timer(
            ttl_minutes * 60, self._cleanup_result, args=(result_id,)
        ).start()

    def get_result(self, result_id: uuid.UUID) -> schema.rest.BulkCreateResponse | None:
        with self._lock:
            entry = self._results.get(result_id)
            if entry is None:
                return None
            expiry, data = entry
            if datetime.datetime.now(datetime.timezone.utc) > expiry:
                del self._results[result_id]
                return None
            return data

    def _cleanup_result(self, result_id: uuid.UUID) -> None:
        with self._lock:
            self._results.pop(result_id, None)


event_stream_manager = EventStreamManager()
