import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

import schema.enum


class RestModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
    )


class EventCreate(RestModel):
    name: str
    description: str | None = None
    date: datetime.date


class EventUpdate(RestModel):
    name: str | None = None
    description: str | None = None
    date: str | None = None
    mode: schema.enum.EventMode | None = None


class EventResponse(RestModel):
    id: str
    name: str
    description: str | None
    date: str
    mode: schema.enum.EventMode
