import contextlib
import logging
import os
import pathlib

import fastapi.staticfiles
import uvicorn
from alembic.config import Config
from alembic import command

import api.admin
import api.auth
import api.checkin
import api.companion
import api.data_source
import api.events
import api.health
import api.info
import api.participants
import api.spreadsheet
import api.streams
import config
import service.auth
import service.data_source
import service.db

# force= because an imported library (pictex) calls bare basicConfig() first, which
# would otherwise make this a no-op and drop every INFO log the app writes.
logging.basicConfig(level=logging.INFO, force=True)
logger = logging.getLogger(__name__)

cfg = config.get_config()


@contextlib.asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    logger.info("Running DB migrations")
    _alembic_cfg = Config(str(pathlib.Path(__file__).resolve().parent / "alembic.ini"))
    command.upgrade(_alembic_cfg, "head")
    logger.info("DB migrations completed!")
    poller_stop = service.data_source.start_poller()
    try:
        yield
    finally:
        poller_stop.set()


app_version = os.getenv("APP_VERSION", "0.0.0")

cfg_for_docs = config.get_config()
app = fastapi.FastAPI(
    title="InQRess",
    version=app_version,
    lifespan=lifespan,
    docs_url="/docs" if cfg_for_docs.server.api_docs else None,
    redoc_url="/redoc" if cfg_for_docs.server.api_docs else None,
    openapi_url="/openapi.json" if cfg_for_docs.server.api_docs else None,
)

app.include_router(api.health.router, prefix="/api")
app.include_router(api.checkin.router_public, prefix="/api")
app.include_router(api.companion.router, prefix="/api")
app.include_router(api.auth.router, prefix="/api")

# All authenticated routes now use the session cookie
app.include_router(
    api.events.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.participants.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.participants.bulk_email_router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.checkin.router_authed,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.spreadsheet.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.data_source.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.streams.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.admin.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)
app.include_router(
    api.info.router,
    prefix="/api",
    dependencies=[fastapi.Depends(service.auth.verify_session_cookie)],
)

frontend_dir = os.environ.get("FRONTEND_DIR")
if frontend_dir:
    logger.info("Mounting frontend from %s", frontend_dir)
    static = fastapi.staticfiles.StaticFiles(directory=frontend_dir, html=True)

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend_spa(path: str, request: fastapi.Request):
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
