import logging
import uuid

import fastapi

import api.utils
import schema.enum
import schema.rest
import service.data_source
import service.event_stream

logger = logging.getLogger(__name__)

router = fastapi.APIRouter(tags=["Data sources"])


def _check_payload(payload: schema.rest.DataSourceBase) -> None:
    if not payload.name.strip():
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST, detail="Name is required"
        )
    if not payload.name_column.strip():
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail="Map the name column before saving",
        )
    if payload.tracking is schema.enum.DataSourceTracking.MATCH and (
        payload.strategy is None or payload.name_match_mode is None
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail="Choose a handling mode and a name match mode",
        )


def _start_sync(
    source: schema.rest.DataSourceResponse,
    event_id: uuid.UUID,
    background_tasks: fastapi.BackgroundTasks,
) -> schema.rest.DataSourceResponse:
    """A save stores the source even when an import already holds the lock."""
    manager = service.event_stream.event_stream_manager
    started = manager.mark_job_active(event_id, "import")
    if started:
        background_tasks.add_task(
            service.data_source.run_sync_task, source.id, event_id
        )
    return source.model_copy(update={"sync_skipped": not started})


def _conflict(code: str, message: str) -> fastapi.HTTPException:
    detail = schema.rest.DataSourceConflictDetail(code=code, message=message)
    return fastapi.HTTPException(
        status_code=fastapi.status.HTTP_409_CONFLICT,
        detail=detail.model_dump(by_alias=True),
    )


def _not_found() -> fastapi.HTTPException:
    return fastapi.HTTPException(
        status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Data source not found"
    )


@router.post("/events/{event_id}/dataSourcePreview")
def preview_data_source(
    event_id: uuid.UUID, payload: schema.rest.DataSourcePreviewRequest
) -> schema.rest.DataSourcePreviewResponse:
    api.utils.check_event_exists(event_id)
    try:
        return service.data_source.preview(payload.url, payload.headers)
    except ValueError as e:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception:
        logger.exception("Failed to read data source link")
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail="Failed to read the file at this link",
        )


@router.get("/events/{event_id}/dataSources")
def list_data_sources(event_id: uuid.UUID) -> list[schema.rest.DataSourceResponse]:
    api.utils.check_event_exists(event_id)
    return service.data_source.list_sources(event_id)


@router.get("/events/{event_id}/dataSources/{source_id}")
def get_data_source(
    event_id: uuid.UUID, source_id: uuid.UUID
) -> schema.rest.DataSourceResponse:
    api.utils.check_event_exists(event_id)
    source = service.data_source.get_source(event_id, source_id)
    if source is None:
        raise _not_found()
    return source


@router.post(
    "/events/{event_id}/dataSources", status_code=fastapi.status.HTTP_201_CREATED
)
def create_data_source(
    event_id: uuid.UUID,
    payload: schema.rest.DataSourceCreate,
    background_tasks: fastapi.BackgroundTasks,
) -> schema.rest.DataSourceResponse:
    api.utils.check_event_exists(event_id)
    if not payload.url.strip():
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST, detail="Link is required"
        )
    _check_payload(payload)
    try:
        source = service.data_source.create_source(event_id, payload)
    except ValueError as e:
        raise _conflict("duplicate_name", str(e))
    return _start_sync(source, event_id, background_tasks)


@router.put("/events/{event_id}/dataSources/{source_id}")
def update_data_source(
    event_id: uuid.UUID,
    source_id: uuid.UUID,
    payload: schema.rest.DataSourceUpdate,
    background_tasks: fastapi.BackgroundTasks,
) -> schema.rest.DataSourceResponse:
    api.utils.check_event_exists(event_id)
    _check_payload(payload)
    current = service.data_source.get_source(event_id, source_id)
    if current is None:
        raise _not_found()
    changed = (
        current.sheet_name != payload.sheet_name.strip()
        or current.tracking != payload.tracking
    )
    has_links = service.data_source.has_row_links(source_id)
    if changed and has_links and not payload.clear_row_links:
        raise _conflict(
            "row_links",
            (
                "This data source matches participants by row number. Changing the "
                "sheet or the tracking mode drops the saved row links, and the next "
                "sync can create a second participant for every row. Confirm to "
                "drop the row links and continue."
            ),
        )
    try:
        source = service.data_source.update_source(event_id, source_id, payload)
    except ValueError as e:
        raise _conflict("duplicate_name", str(e))
    if source is None:
        raise _not_found()
    return _start_sync(source, event_id, background_tasks)


@router.delete(
    "/events/{event_id}/dataSources/{source_id}",
    status_code=fastapi.status.HTTP_204_NO_CONTENT,
)
def delete_data_source(event_id: uuid.UUID, source_id: uuid.UUID) -> None:
    api.utils.check_event_exists(event_id)
    if not service.data_source.delete_source(event_id, source_id):
        raise _not_found()


@router.post(
    "/events/{event_id}/dataSources/{source_id}/sync",
    status_code=fastapi.status.HTTP_202_ACCEPTED,
)
def sync_data_source(
    event_id: uuid.UUID,
    source_id: uuid.UUID,
    background_tasks: fastapi.BackgroundTasks,
) -> dict:
    api.utils.check_event_exists(event_id)
    if service.data_source.get_source(event_id, source_id) is None:
        raise _not_found()
    manager = service.event_stream.event_stream_manager
    if not manager.mark_job_active(event_id, "import"):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="Another sync or import is already running for this event",
        )
    background_tasks.add_task(service.data_source.run_sync_task, source_id, event_id)
    return {"message": "Sync started"}


@router.put("/events/{event_id}/dataSources/{source_id}/activated")
def set_data_source_activated(
    event_id: uuid.UUID,
    source_id: uuid.UUID,
    payload: schema.rest.DataSourceActivatedUpdate,
) -> schema.rest.DataSourceResponse:
    api.utils.check_event_exists(event_id)
    source = service.data_source.set_activated(event_id, source_id, payload.activated)
    if source is None:
        raise _not_found()
    return source
