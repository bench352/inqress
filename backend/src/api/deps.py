import uuid

from fastapi import HTTPException, status

from service import events as events_service


def check_event_exists(event_id: uuid.UUID):
    event = events_service.get_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event
