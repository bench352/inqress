import uuid

from pydantic import BaseModel


class TicketPayload(BaseModel):
    event_id: uuid.UUID
    attendee_id: uuid.UUID
