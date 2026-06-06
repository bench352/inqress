import asyncio
import collections.abc
import logging
import typing

import fastapi
import fastapi.sse

import service.admin_stream
import service.auth

logger = logging.getLogger(__name__)

admin_manager = service.admin_stream.admin_stream_manager
router = fastapi.APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/streams", response_class=fastapi.sse.EventSourceResponse)
async def admin_streams(
    token: typing.Annotated[str | None, fastapi.Query()] = None,
) -> collections.abc.AsyncIterable[fastapi.sse.ServerSentEvent]:
    service.auth.verify_basic_auth_query(token=token)

    q: asyncio.Queue = admin_manager.subscribe()
    try:
        while True:
            event = await q.get()
            yield fastapi.sse.ServerSentEvent(data=event.model_dump(by_alias=True))
    except asyncio.CancelledError:
        pass
    finally:
        admin_manager.unsubscribe(q)
