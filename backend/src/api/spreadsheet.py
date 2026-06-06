import datetime
import logging
import uuid

import fastapi

import api.utils
import schema.rest
import service.participants
import service.spreadsheet
import service.event_stream

logger = logging.getLogger(__name__)

router = fastapi.APIRouter(prefix="/events/{event_id}", tags=["Spreadsheet"])


@router.post("/spreadsheetPreview")
def spreadsheet_preview(
    event_id: uuid.UUID, file: fastapi.UploadFile = fastapi.File(...)
) -> schema.rest.SpreadsheetPreviewResponse:
    api.utils.check_event_exists(event_id)
    try:
        workbook = service.spreadsheet.parse_workbook(
            file.file.read(), file.filename or "upload.xlsx"
        )
    except ValueError as e:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception:
        logger.exception("Failed to parse uploaded file")
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail="Failed to parse file",
        )

    task_id = service.spreadsheet.store_workbook(workbook)
    expiry = datetime.datetime.now() + datetime.timedelta(minutes=30)
    sheets: dict[str, schema.rest.SheetPreview] = {}
    for name, (columns, rows) in workbook.items():
        sheets[name] = schema.rest.SheetPreview(columns=columns, heads=rows[:5])
    return schema.rest.SpreadsheetPreviewResponse(
        task_id=task_id,
        expire_in=expiry,
        sheets=sheets,
    )


@router.post("/spreadsheetImport", status_code=fastapi.status.HTTP_202_ACCEPTED)
def spreadsheet_import(
    event_id: uuid.UUID,
    payload: schema.rest.SpreadsheetImportRequest,
    background_tasks: fastapi.BackgroundTasks,
) -> dict:
    api.utils.check_event_exists(event_id)

    workbook = service.spreadsheet.get_workbook(payload.task_id)
    if workbook is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Upload session expired or not found. Please re-upload.",
        )
    if payload.sheet_name not in workbook:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_400_BAD_REQUEST,
            detail=f"Sheet '{payload.sheet_name}' not found in workbook",
        )

    mapped = service.spreadsheet.map_rows(
        workbook,
        payload.sheet_name,
        payload.row_mapping.title_column,
        payload.row_mapping.name_column,
        payload.row_mapping.raw_phone_column,
        payload.row_mapping.email_column,
    )

    manager = service.event_stream.event_stream_manager
    if not manager.mark_job_active(event_id, "import"):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="An import is already in progress for this event",
        )

    background_tasks.add_task(
        service.participants.bulk_create_and_notify,
        event_id,
        mapped,
        payload.strategy,
        payload.name_match_mode,
    )
    return {"message": "Import started"}
