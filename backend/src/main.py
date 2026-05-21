import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Depends

import api.events
import api.health
from schema.orm import Base
from service.auth import verify_basic_auth
from service.db import get_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing DB schema")
    Base.metadata.create_all(get_engine())
    yield


app = FastAPI(title="InQRess", lifespan=lifespan)

app.include_router(api.health.router, prefix="/api")
app.include_router(
    api.events.router, prefix="/api", dependencies=[Depends(verify_basic_auth)]
)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
