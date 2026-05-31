import asyncio
import logging
import queue
import uuid
from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from api.deps import check_event_exists
from schema.booth import BoothCommandRequest, BoothLifecycleStatus, BoothStatusResponse
from schema.sse import (
    BoothLifecycleData,
    ChangeModeData,
    ControlCommandData,
    SseEvent,
    SseEventType,
    SseType,
)
from service.admin_stream import AdminStreamManager
from service.auth import verify_basic_auth, verify_basic_auth_query
from service.booth_stream import BoothAlreadyConnected, BoothStreamManager

logger = logging.getLogger(__name__)

booth_manager = BoothStreamManager()
admin_manager = AdminStreamManager()
router = APIRouter(prefix="/events/{event_id}/checkInBooth", tags=["checkin-booth"])


@router.get("/streams", response_class=EventSourceResponse)
async def booth_stream(
    event_id: uuid.UUID,
    token: Annotated[str | None, Query()] = None,
) -> AsyncIterable[ServerSentEvent]:
    verify_basic_auth_query(token=token)
    event = check_event_exists(event_id)

    try:
        q: queue.Queue = booth_manager.subscribe(event_id)
    except BoothAlreadyConnected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Booth is already connected for this event",
        )

    booth_manager.send(
        event_id,
        SseEvent[ChangeModeData](
            event_type=SseEventType.CHANGE_MODE,
            type=SseType.COMMAND,
            data=ChangeModeData(value=event.mode),
        ),
        sticky=True,
    )

    admin_manager.broadcast(
        SseEvent[BoothLifecycleData](
            event_type=SseEventType.BOOTH_LIFECYCLE,
            type=SseType.NOTIFICATION,
            data=BoothLifecycleData(
                event_id=str(event_id),
                event_name=event.name,
                status=BoothLifecycleStatus.CONNECTED,
            ),
        )
    )

    loop = asyncio.get_event_loop()
    try:
        while True:
            try:
                ev = await loop.run_in_executor(None, lambda: q.get(timeout=15))
                yield ServerSentEvent(data=ev.model_dump(by_alias=True))
            except queue.Empty:
                yield ServerSentEvent(comment="")
    except asyncio.CancelledError:
        pass
    finally:
        booth_manager.unsubscribe(event_id)
        admin_manager.broadcast(
            SseEvent[BoothLifecycleData](
                event_type=SseEventType.BOOTH_LIFECYCLE,
                type=SseType.NOTIFICATION,
                data=BoothLifecycleData(
                    event_id=str(event_id),
                    event_name=event.name,
                    status=BoothLifecycleStatus.DISCONNECTED,
                ),
            )
        )


@router.get("/status")
def booth_status(
    event_id: uuid.UUID,
    _: str = Depends(verify_basic_auth),
) -> BoothStatusResponse:
    check_event_exists(event_id)
    return BoothStatusResponse(connected=booth_manager.is_connected(event_id))


@router.post("/command", status_code=status.HTTP_204_NO_CONTENT)
def booth_command(
    event_id: uuid.UUID,
    payload: BoothCommandRequest,
    _: str = Depends(verify_basic_auth),
) -> None:
    check_event_exists(event_id)
    booth_manager.send(
        event_id,
        SseEvent[ControlCommandData](
            event_type=SseEventType.CONTROL,
            type=SseType.COMMAND,
            data=ControlCommandData(command=payload.command, params=payload.params),
        ),
    )
