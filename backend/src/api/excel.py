import datetime
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, status

from schema.rest import (
    BulkCreateResponse,
    ExcelImportRequest,
    ExcelPreviewResponse,
    SheetPreview,
)
from service import attendees as attendees_service
from service import events as events_service
from service import excel as excel_service
from service.ticket import generate_ticket_images

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events/{event_id}", tags=["excel"])


def _check_event(event_id: uuid.UUID):
    event = events_service.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )


@router.post("/excelPreview")
def excel_preview(event_id: uuid.UUID, file: UploadFile = File(...)) -> ExcelPreviewResponse:
    _check_event(event_id)
    try:
        workbook = excel_service.parse_workbook(file.file.read(), file.filename or "upload.xlsx")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        logger.exception("Failed to parse uploaded file")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to parse file")

    task_id = excel_service.store_workbook(workbook)
    expiry = datetime.datetime.now() + datetime.timedelta(minutes=30)
    sheet_names = []
    sheets: dict[str, SheetPreview] = {}
    for name, (columns, rows) in workbook.items():
        sheet_names.append(name)
        sheets[name] = SheetPreview(columns=columns, heads=rows[:5])
    return ExcelPreviewResponse(
        task_id=task_id,
        expire_in=expiry,
        sheet_names=sheet_names,
        sheets=sheets,
    )


@router.post("/excelImport")
def excel_import(event_id: uuid.UUID, payload: ExcelImportRequest, background_tasks: BackgroundTasks) -> BulkCreateResponse:
    _check_event(event_id)
    workbook = excel_service.get_workbook(payload.task_id)
    if workbook is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload session expired or not found. Please re-upload.",
        )
    if payload.sheet_name not in workbook:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sheet '{payload.sheet_name}' not found in workbook",
        )
    mapped = excel_service.map_rows(
        workbook,
        payload.sheet_name,
        payload.row_mapping.title_column,
        payload.row_mapping.name_column,
        payload.row_mapping.raw_phone_column,
        payload.row_mapping.email_column,
    )
    result = attendees_service.bulk_create(event_id, mapped)
    if result.created:
        background_tasks.add_task(generate_ticket_images, event_id)
    return result
