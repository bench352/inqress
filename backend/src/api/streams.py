import logging
import queue
import uuid
from collections.abc import Iterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from api.deps import check_event_exists
from schema.rest import BulkCreateResponse
from service.auth import verify_basic_auth, verify_basic_auth_query
from service.event_stream import EventStreamManager

logger = logging.getLogger(__name__)

manager = EventStreamManager()
router = APIRouter(prefix="/events/{event_id}", tags=["streams"])


@router.get("/streams", response_class=EventSourceResponse)
def stream_events(
    event_id: uuid.UUID,
    token: Annotated[str | None, Query()] = None,
) -> Iterable[ServerSentEvent]:
    verify_basic_auth_query(token=token)
    check_event_exists(event_id)

    q: queue.Queue = manager.subscribe(event_id)
    try:
        while True:
            try:
                event = q.get(timeout=15)
                yield ServerSentEvent(data=event.model_dump(by_alias=True))
            except queue.Empty:
                yield ServerSentEvent(comment="")
    except GeneratorExit:
        pass
    finally:
        manager.unsubscribe(event_id, q)


@router.get("/importResult/{result_id}")
def get_import_result(
    event_id: uuid.UUID,
    result_id: uuid.UUID,
    _: str = Depends(verify_basic_auth),
) -> BulkCreateResponse:
    check_event_exists(event_id)
    result = manager.get_result(result_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found or expired",
        )
    return result
