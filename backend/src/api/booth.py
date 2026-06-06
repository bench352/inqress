import asyncio
import logging
import queue
import uuid
from collections.abc import AsyncIterable
from typing import Annotated

import fastapi
import fastapi.sse

import api.utils
import schema.booth
import schema.sse
import service.admin_stream
import service.auth
import service.booth_stream

logger = logging.getLogger(__name__)

booth_manager = service.booth_stream.booth_stream_manager
admin_manager = service.admin_stream.admin_stream_manager
router = fastapi.APIRouter(
    prefix="/events/{event_id}/checkInBooth", tags=["Check-in Booth"]
)


@router.get("/streams", response_class=fastapi.sse.EventSourceResponse)
async def booth_stream(
    event_id: uuid.UUID,
    token: Annotated[str | None, fastapi.Query()] = None,
) -> AsyncIterable[fastapi.sse.ServerSentEvent]:
    service.auth.verify_basic_auth_query(token=token)
    event = api.utils.check_event_exists(event_id)

    try:
        q: queue.Queue = booth_manager.subscribe(event_id)
    except service.booth_stream.BoothAlreadyConnected:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="Booth is already connected for this event",
        )

    booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ChangeModeData](
            event_type=schema.sse.SseEventType.CHANGE_MODE,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ChangeModeData(value=event.mode),
        ),
        sticky=True,
    )

    admin_manager.broadcast(
        schema.sse.SseEvent[schema.sse.BoothLifecycleData](
            event_type=schema.sse.SseEventType.BOOTH_LIFECYCLE,
            type=schema.sse.SseType.NOTIFICATION,
            data=schema.sse.BoothLifecycleData(
                event_id=str(event_id),
                event_name=event.name,
                status=schema.booth.BoothLifecycleStatus.CONNECTED,
            ),
        )
    )

    loop = asyncio.get_event_loop()
    try:
        while True:
            try:
                ev = await loop.run_in_executor(None, lambda: q.get(timeout=15))
                yield fastapi.sse.ServerSentEvent(data=ev.model_dump(by_alias=True))
            except queue.Empty:
                yield fastapi.sse.ServerSentEvent(comment="")
    except asyncio.CancelledError:
        pass
    finally:
        booth_manager.unsubscribe(event_id)
        admin_manager.broadcast(
            schema.sse.SseEvent[schema.sse.BoothLifecycleData](
                event_type=schema.sse.SseEventType.BOOTH_LIFECYCLE,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.BoothLifecycleData(
                    event_id=str(event_id),
                    event_name=event.name,
                    status=schema.booth.BoothLifecycleStatus.DISCONNECTED,
                ),
            )
        )


@router.get("/status")
def booth_status(
    event_id: uuid.UUID,
    _: str = fastapi.Depends(service.auth.verify_basic_auth),
) -> schema.booth.BoothStatusResponse:
    api.utils.check_event_exists(event_id)
    return schema.booth.BoothStatusResponse(
        connected=booth_manager.is_connected(event_id)
    )


@router.post("/command", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def booth_command(
    event_id: uuid.UUID,
    payload: schema.booth.BoothCommandRequest,
    _: str = fastapi.Depends(service.auth.verify_basic_auth),
) -> None:
    api.utils.check_event_exists(event_id)
    booth_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ControlCommandData](
            event_type=schema.sse.SseEventType.CONTROL,
            type=schema.sse.SseType.COMMAND,
            data=schema.sse.ControlCommandData(
                command=payload.command, params=payload.params
            ),
        ),
    )
