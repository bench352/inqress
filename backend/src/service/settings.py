import uuid

from sqlalchemy import select, update

import schema.orm
import schema.rest
import service.db


def get_email_settings(event_id: uuid.UUID) -> schema.rest.EmailSettingsResponse | None:
    with service.db.get_session() as session:
        row = session.execute(
            select(
                schema.orm.Event.email_subject,
                schema.orm.Event.email_sender_name,
            ).where(schema.orm.Event.id == event_id)
        ).first()
        if row is None:
            return None
        return schema.rest.EmailSettingsResponse(
            subject=row.email_subject, sender_name=row.email_sender_name
        )


def update_email_settings(
    event_id: uuid.UUID, settings: schema.rest.EmailSettingsRequest
) -> bool:
    with service.db.get_session() as session:
        result = session.execute(
            update(schema.orm.Event)
            .where(schema.orm.Event.id == event_id)
            .values(
                email_subject=settings.subject,
                email_sender_name=settings.sender_name,
            )
        )
        return result.rowcount > 0  # type: ignore[attr-defined]
