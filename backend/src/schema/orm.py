import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    String,
    Text,
    LargeBinary,
    Integer,
    UniqueConstraint,
    Uuid,
    select,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    column_property,
    mapped_column,
    relationship,
)

import schema.enum


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "event"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    date: Mapped[str] = mapped_column(String, nullable=False)
    mode: Mapped[str] = mapped_column(
        String, nullable=False, default=schema.enum.EventMode.DISABLED
    )
    email_template: Mapped[str] = mapped_column(Text, nullable=False)
    booth_image: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    booth_image_type: Mapped[str | None] = mapped_column(String, nullable=True)

    attendees: Mapped[list["Attendee"]] = relationship(back_populates="event")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="event"
    )


class Attendee(Base):
    __tablename__ = "attendee"
    __table_args__ = (
        UniqueConstraint("event_id", "email"),
        UniqueConstraint("event_id", "phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("event.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    raw_phone: Mapped[str] = mapped_column(String, nullable=False)
    country_code: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    ticket_token: Mapped[str] = mapped_column(String, nullable=False)
    ticket_img: Mapped[bytes | None] = mapped_column(LargeBinary)
    is_ticket_delivered: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    event: Mapped["Event"] = relationship(back_populates="attendees")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="attendee"
    )


class AttendanceLog(Base):
    __tablename__ = "attendance_log"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("event.id", ondelete="CASCADE"), nullable=False
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("attendee.id", ondelete="CASCADE"), nullable=False
    )
    checked_in_at: Mapped[str] = mapped_column(String, nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)
    device_info: Mapped[str | None] = mapped_column(Text)
    is_test: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    event: Mapped["Event"] = relationship(back_populates="attendance_logs")
    attendee: Mapped["Attendee"] = relationship(back_populates="attendance_logs")


Attendee.checkedInAt = column_property(
    select(AttendanceLog.checked_in_at)
    .where(AttendanceLog.attendee_id == Attendee.id)
    .correlate_except(AttendanceLog)
    .scalar_subquery()
)

Attendee.isTicketReady = column_property(Attendee.ticket_img.isnot(None))

Event.hasBoothImage = column_property(Event.booth_image.isnot(None))
