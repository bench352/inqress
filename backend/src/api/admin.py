import asyncio
import logging
from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.sse import EventSourceResponse, ServerSentEvent

from service.admin_stream import AdminStreamManager
from service.auth import verify_basic_auth_query

logger = logging.getLogger(__name__)

admin_manager = AdminStreamManager()
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/streams", response_class=EventSourceResponse)
async def admin_streams(
    token: Annotated[str | None, Query()] = None,
) -> AsyncIterable[ServerSentEvent]:
    verify_basic_auth_query(token=token)

    q: asyncio.Queue = admin_manager.subscribe()
    try:
        while True:
            event = await q.get()
            yield ServerSentEvent(data=event.model_dump(by_alias=True))
    except asyncio.CancelledError:
        pass
    finally:
        admin_manager.unsubscribe(q)
