import pathlib
import secrets
import uuid

import phonenumbers
from sqlalchemy import delete, insert, select, update

import config
import schema.enum
import schema.orm
import schema.rest
import service.db
import service.ticket

_DEFAULT_TEMPLATE_PATH = (
    pathlib.Path(__file__).resolve().parent.parent
    / "assets"
    / "default_email_template.md"
)


def _load_default_template() -> str:
    return _DEFAULT_TEMPLATE_PATH.read_text()


def list_events() -> list[schema.rest.EventResponse]:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event).order_by(schema.orm.Event.name)
        )
        return [
            schema.rest.EventResponse.model_validate(row)
            for row in result.scalars().all()
        ]


def get_event(event_id: uuid.UUID) -> schema.rest.EventResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event).where(schema.orm.Event.id == event_id)
        )
        row = result.scalars().first()
        return schema.rest.EventResponse.model_validate(row) if row else None


def create_event(payload: schema.rest.EventCreate) -> schema.rest.EventResponse:
    default_template = _load_default_template()
    token = secrets.token_urlsafe(32)
    key_pair = service.ticket.generate_key_pair()
    with service.db.get_session() as session:
        result = session.execute(
            insert(schema.orm.Event)
            .values(
                id=uuid.uuid4(),
                name=payload.name,
                description=payload.description,
                date=payload.date,
                email_template=default_template,
                companion_token=token,
                kiosk_message="",
                paseto_private_key=key_pair.private_pem,
                paseto_public_key=key_pair.public_pem,
            )
            .returning(schema.orm.Event)
        )
        return schema.rest.EventResponse.model_validate(result.scalars().one())


def update_event(
    event_id: uuid.UUID, payload: schema.rest.EventPut
) -> schema.rest.EventResponse | None:
    values = payload.model_dump(by_alias=False)
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(**values)
            .returning(schema.orm.Event)
        )
        row = result.scalars().first()
        return schema.rest.EventResponse.model_validate(row) if row else None


def delete_event(event_id: uuid.UUID) -> schema.rest.EventResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event).where(schema.orm.Event.id == event_id)
        )
        row = result.scalars().first()
        if row is None:
            return None
        response = schema.rest.EventResponse.model_validate(row)
        session.execute(delete(schema.orm.Event).where(schema.orm.Event.id == event_id))
        return response


def update_event_mode(
    event_id: uuid.UUID, mode: schema.enum.EventMode
) -> schema.rest.EventResponse | None:
    with service.db.get_session() as session:
        # Leaving Test mode (to any other mode) drops the trial attendance.
        if mode is not schema.enum.EventMode.TEST:
            session.execute(
                delete(schema.orm.AttendanceLog).where(
                    schema.orm.AttendanceLog.event_id == event_id,
                    schema.orm.AttendanceLog.is_test == 1,
                )
            )

        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(mode=mode)
            .returning(schema.orm.Event)
        )
        row = result.scalars().first()
        return schema.rest.EventResponse.model_validate(row) if row else None


def get_email_template(event_id: uuid.UUID) -> schema.rest.EmailTemplateResponse | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event.email_template).where(
                schema.orm.Event.id == event_id
            )
        )
        text = result.scalars().first()
        return (
            schema.rest.EmailTemplateResponse(text=text) if text is not None else None
        )


def update_email_template(event_id: uuid.UUID, text: str) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(email_template=text)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]


def get_booth_image(event_id: uuid.UUID) -> tuple[bytes, str] | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(
                schema.orm.Event.booth_image, schema.orm.Event.booth_image_type
            ).where(schema.orm.Event.id == event_id)
        )
        row = result.first()
        if row is None or row[0] is None:
            return None
        return row[0], row[1] or "image/png"


def set_booth_image(event_id: uuid.UUID, image_bytes: bytes, content_type: str) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(booth_image=image_bytes, booth_image_type=content_type)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]


def clear_booth_image(event_id: uuid.UUID) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(booth_image=None, booth_image_type=None)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]


def get_accent_color(event_id: uuid.UUID) -> str | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event.accent_color).where(schema.orm.Event.id == event_id)
        )
        row = result.scalars().first()
        return row


def set_accent_color(event_id: uuid.UUID, color_code: str) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(accent_color=color_code)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]


def get_unique_country_codes(event_id: uuid.UUID) -> schema.rest.CountryCodesResponse:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Participant.country_code)
            .where(schema.orm.Participant.event_id == event_id)
            .distinct()
        )
        options = [row[0] for row in result.all() if row[0]]

    cfg = config.get_config()
    try:
        cc = phonenumbers.country_code_for_region(cfg.app.default_country_code)
        default = f"+{cc}"
    except Exception:
        default = options[0] if options else ""

    return schema.rest.CountryCodesResponse(default=default, options=options)


def get_companion_token(event_id: uuid.UUID) -> str | None:
    """Return the current companion token (for admin QR display)."""
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event.companion_token).where(
                schema.orm.Event.id == event_id
            )
        )
        return result.scalars().first()


def rotate_companion_token(event_id: uuid.UUID) -> str | None:
    """Generate and store a new companion token. Returns the new token or None if event missing."""
    new_token = secrets.token_urlsafe(32)
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(companion_token=new_token)
            .returning(schema.orm.Event.companion_token)
        )
        return result.scalars().first()


def get_kiosk_message(event_id: uuid.UUID) -> str | None:
    with service.db.get_session() as session:
        result = session.execute(
            select(schema.orm.Event.kiosk_message).where(
                schema.orm.Event.id == event_id
            )
        )
        return result.scalars().first()


def set_kiosk_message(event_id: uuid.UUID, message: str) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(kiosk_message=message)
        )
        return result.rowcount > 0  # type: ignore[attr-defined]
