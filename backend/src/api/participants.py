import logging
import uuid

import fastapi
import fastapi.responses

import api.utils
import config
import service.checkin
import service.email
import service.events
import service.ticket
import service.participants
import schema.enum
import schema.rest
import service.event_stream

logger = logging.getLogger(__name__)

router = fastapi.APIRouter(
    prefix="/events/{event_id}/participants", tags=["Participants"]
)


def check_participant_exists(event_id: uuid.UUID, participant_id: uuid.UUID) -> None:
    if service.participants.get_participant(event_id, participant_id) is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )


@router.get("")
def list_participants(event_id: uuid.UUID) -> list[schema.rest.ParticipantResponse]:
    api.utils.check_event_exists(event_id)
    return service.participants.list_participants(event_id)


@router.post("", status_code=fastapi.status.HTTP_202_ACCEPTED)
def bulk_create_participants(
    event_id: uuid.UUID,
    payload: dict,
    background_tasks: fastapi.BackgroundTasks,
) -> dict:
    api.utils.check_event_exists(event_id)

    if not service.event_stream.event_stream_manager.mark_job_active(
        event_id, "import"
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="An import is already in progress for this event",
        )

    strategy = schema.enum.DuplicateStrategy(payload.get("strategy", "skip"))
    name_match_mode = schema.enum.NameMatchMode(payload.get("nameMatchMode", "exact"))
    data = [
        schema.rest.ParticipantCreate.model_validate(item)
        for item in payload.get("data", [])
    ]

    background_tasks.add_task(
        service.participants.bulk_create_and_notify,
        event_id,
        data,
        strategy,
        name_match_mode,
    )
    return {"message": "Import started"}


@router.get("/{participant_id}")
def get_participant(
    event_id: uuid.UUID, participant_id: uuid.UUID
) -> schema.rest.ParticipantResponse:
    api.utils.check_event_exists(event_id)
    participant = service.participants.get_participant(event_id, participant_id)
    if participant is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )
    return participant


@router.put("/{participant_id}")
def update_participant(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: schema.rest.ParticipantPut,
) -> schema.rest.ParticipantResponse:
    api.utils.check_event_exists(event_id)
    check_participant_exists(event_id, participant_id)
    result = service.participants.update_participant(event_id, participant_id, payload)
    if result is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )
    return result


@router.delete("")
def bulk_delete_participants(
    event_id: uuid.UUID, payload: list[uuid.UUID]
) -> schema.rest.BulkDeleteResponse:
    api.utils.check_event_exists(event_id)
    return service.participants.bulk_delete(event_id, payload)


@router.get("/{participant_id}/ticket/preview")
def preview_ticket(event_id: uuid.UUID, participant_id: uuid.UUID):
    img_bytes = service.checkin.get_ticket_image(event_id, participant_id)
    if img_bytes is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    return fastapi.responses.Response(content=img_bytes, media_type="image/png")


@router.get("/{participant_id}/email/preview")
def preview_email(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> fastapi.responses.HTMLResponse:
    event = api.utils.check_event_exists(event_id)
    participant = service.participants.get_participant(event_id, participant_id)
    if participant is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )
    qr_bytes = service.checkin.get_ticket_image(event_id, participant_id)
    if qr_bytes is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    template = service.events.get_email_template(event_id)
    if template is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Email template not found",
        )
    cfg = config.get_config()
    sender_name = cfg.app.organization_name or "Event Organizer"
    html = service.email.render_preview_html(
        template.text,
        participant.title,
        participant.name,
        event.name,
        sender_name,
        qr_bytes,
    )
    return fastapi.responses.HTMLResponse(content=html)


@router.post("/{participant_id}/email", status_code=fastapi.status.HTTP_204_NO_CONTENT)
def send_email(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> fastapi.responses.Response:
    event = api.utils.check_event_exists(event_id)
    participant = service.participants.get_participant(event_id, participant_id)
    if participant is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )
    if not participant.email:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Participant has no email address",
        )
    qr_bytes = service.checkin.get_ticket_image(event_id, participant_id)
    if qr_bytes is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    template = service.events.get_email_template(event_id)
    if template is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND,
            detail="Email template not found",
        )
    cfg = config.get_config()
    subject = f"[Ticket] {event.name}"
    service.email.send_ticket_email(
        participant.email or "",
        subject,
        template.text,
        participant.title,
        participant.name,
        event.name,
        cfg.app.organization_name or "Event Organizer",
        qr_bytes,
    )
    if not service.participants.mark_ticket_delivered(event_id, participant_id):
        logger.warning(
            "Failed to mark ticket delivered for participant %s in event %s",
            participant_id,
            event_id,
        )
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)


@router.post(
    "/{participant_id}/ticket/delivery", status_code=fastapi.status.HTTP_204_NO_CONTENT
)
def mark_ticket_delivered(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> fastapi.responses.Response:
    api.utils.check_event_exists(event_id)
    check_participant_exists(event_id, participant_id)
    service.participants.mark_ticket_delivered(event_id, participant_id)
    return fastapi.responses.Response(status_code=fastapi.status.HTTP_204_NO_CONTENT)


bulk_email_router = fastapi.APIRouter(prefix="/events/{event_id}", tags=["bulk-email"])


@bulk_email_router.post("/emails", status_code=fastapi.status.HTTP_202_ACCEPTED)
def bulk_send_email(
    event_id: uuid.UUID,
    background_tasks: fastapi.BackgroundTasks,
    payload: list[uuid.UUID] = fastapi.Body(...),
) -> dict:
    api.utils.check_event_exists(event_id)
    for participant_id in payload:
        check_participant_exists(event_id, participant_id)

    if not service.event_stream.event_stream_manager.mark_job_active(
        event_id, "bulk_email"
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="Bulk email sending is already in progress for this event",
        )

    background_tasks.add_task(
        service.email.bulk_send_and_notify,
        event_id,
        payload,
        service.events.get_event,
        service.events.get_email_template,
        service.participants.get_participant,
        service.checkin.get_ticket_image,
        service.participants.mark_ticket_delivered,
    )
    return {"message": "Bulk email sending started"}


@bulk_email_router.post("/ticketQRs", status_code=fastapi.status.HTTP_202_ACCEPTED)
def bulk_generate_ticket_qrs(
    event_id: uuid.UUID,
    background_tasks: fastapi.BackgroundTasks,
    payload: list[uuid.UUID] = fastapi.Body(...),
) -> dict:
    api.utils.check_event_exists(event_id)
    for participant_id in payload:
        check_participant_exists(event_id, participant_id)

    if not service.event_stream.event_stream_manager.mark_job_active(
        event_id, "ticket_qr"
    ):
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_409_CONFLICT,
            detail="Ticket QR generation is already in progress for this event",
        )

    background_tasks.add_task(service.ticket.generate_qrs_and_notify, event_id, payload)
    return {"message": "Ticket QR generation started"}
