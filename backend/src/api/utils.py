import uuid

import fastapi

import service.events


def check_event_exists(event_id: uuid.UUID):
    event = service.events.get_event(event_id)
    if event is None:
        raise fastapi.HTTPException(
            status_code=fastapi.status.HTTP_404_NOT_FOUND, detail="Event not found"
        )
    return event
