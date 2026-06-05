import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Depends, Request
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
import api.admin
import api.attendees
import api.booth
import api.checkin
import api.events
import api.excel
import api.health
import api.info
import api.streams
from config import get_config
from schema.orm import Base
from service.auth import verify_basic_auth
from service.db import ENGINE
from service.ticket import init_keys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

cfg = get_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing DB schema")
    Base.metadata.create_all(ENGINE)
    logger.info("Initializing ticket keys")
    init_keys()
    yield


app = FastAPI(title="InQRess", lifespan=lifespan)

app.include_router(api.health.router, prefix="/api")
app.include_router(api.checkin.router_public, prefix="/api")
app.include_router(
    api.events.router, prefix="/api", dependencies=[Depends(verify_basic_auth)]
)
app.include_router(
    api.attendees.router, prefix="/api", dependencies=[Depends(verify_basic_auth)]
)
app.include_router(
    api.attendees.bulk_email_router,
    prefix="/api",
    dependencies=[Depends(verify_basic_auth)],
)
app.include_router(
    api.checkin.router_authed,
    prefix="/api",
    dependencies=[Depends(verify_basic_auth)],
)
app.include_router(
    api.excel.router, prefix="/api", dependencies=[Depends(verify_basic_auth)]
)
app.include_router(api.streams.router, prefix="/api")
app.include_router(api.booth.router, prefix="/api")
app.include_router(api.admin.router, prefix="/api")
app.include_router(
    api.info.router, prefix="/api", dependencies=[Depends(verify_basic_auth)]
)

frontend_dir = cfg.server.frontend_dir
if frontend_dir:
    logger.info("Mounting frontend from %s", frontend_dir)
    static = StaticFiles(directory=frontend_dir, html=True)

    @app.get("/{path:path}")
    async def frontend_spa(path: str, request: Request):
        path = path.lstrip("/")
        full_path, stat_path = static.lookup_path(path)
        if stat_path is not None:
            return await static.get_response(path, request.scope)
        return await static.get_response("index.html", request.scope)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=cfg.server.host,
        port=cfg.server.port,
        reload=cfg.server.debug,
    )
