import logging
import queue
import uuid
from collections.abc import Iterable
from typing import Annotated

import fastapi
import fastapi.sse

import api.utils
import schema.rest
import service.auth
import service.event_stream

logger = logging.getLogger(__name__)

manager = service.event_stream.event_stream_manager
router = fastapi.APIRouter(prefix="/events/{event_id}", tags=["Streams"])


@router.get("/streams", response_class=fastapi.sse.EventSourceResponse)
def stream_events(
    event_id: uuid.UUID,
    token: Annotated[str | None, fastapi.Query()] = None,
) -> Iterable[fastapi.sse.ServerSentEvent]:
    service.auth.verify_basic_auth_query(token=token)
    api.utils.check_event_exists(event_id)

    q: queue.Queue = manager.subscribe(event_id)
    try:
        while True:
            try:
                event = q.get(timeout=15)
                yield fastapi.sse.ServerSentEvent(data=event.model_dump(by_alias=True))
            except queue.Empty:
                yield fastapi.sse.ServerSentEvent(comment="")
    except GeneratorExit:
        pass
    finally:
        manager.unsubscribe(event_id, q)


@router.get("/importResult/{result_id}")
def get_import_result(
    event_id: uuid.UUID,
    result_id: uuid.UUID,
    _: str = fastapi.Depends(service.auth.verify_basic_auth),
) -> schema.rest.BulkCreateResponse:
    api.utils.check_event_exists(event_id)
    result = manager.get_result(result_id)
    if result is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Result not found or expired",
        )
    return result
