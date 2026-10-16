import uuid
from datetime import datetime

import sqlalchemy
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    DeclarativeBase,
    relationship,
    column_property,
)


import schema.enum


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "event"

    id: Mapped[uuid.UUID] = mapped_column(sqlalchemy.Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    description: Mapped[str] = mapped_column(
        sqlalchemy.Text, nullable=False, default=""
    )
    date: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    mode: Mapped[str] = mapped_column(
        sqlalchemy.String, nullable=False, default=schema.enum.EventMode.DISABLED
    )
    email_template: Mapped[str] = mapped_column(sqlalchemy.Text, nullable=False)
    booth_image: Mapped[bytes | None] = mapped_column(
        sqlalchemy.LargeBinary, nullable=True
    )
    booth_image_type: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
    accent_color: Mapped[str] = mapped_column(
        sqlalchemy.String, nullable=False, default="#000000", server_default="#000000"
    )
    companion_token: Mapped[str] = mapped_column(
        sqlalchemy.String, nullable=False, unique=True
    )
    kiosk_message: Mapped[str] = mapped_column(
        sqlalchemy.Text, nullable=False, default=""
    )

    participants: Mapped[list["Participant"]] = relationship(back_populates="event")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="event"
    )


class Participant(Base):
    __tablename__ = "participant"

    id: Mapped[uuid.UUID] = mapped_column(sqlalchemy.Uuid, primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    name: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    email: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    raw_phone: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    country_code: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    phone: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    ticket_token: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    ticket_img: Mapped[bytes | None] = mapped_column(sqlalchemy.LargeBinary)
    is_ticket_delivered: Mapped[bool] = mapped_column(
        sqlalchemy.Boolean, nullable=False, default=False
    )

    event: Mapped["Event"] = relationship(back_populates="participants")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="participant"
    )


class AttendanceLog(Base):
    __tablename__ = "attendance_log"
    __table_args__ = (
        sqlalchemy.UniqueConstraint(
            "event_id",
            "participant_id",
            name="uq_attendance_event_participant",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sqlalchemy.Uuid, primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("participant.id", ondelete="CASCADE"),
        nullable=False,
    )
    checked_in_at: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    method: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    device_info: Mapped[str | None] = mapped_column(sqlalchemy.Text)
    is_test: Mapped[int] = mapped_column(sqlalchemy.Integer, nullable=False, default=0)

    event: Mapped["Event"] = relationship(back_populates="attendance_logs")
    participant: Mapped["Participant"] = relationship(back_populates="attendance_logs")


Participant.checkedInAt = column_property(
    sqlalchemy.select(AttendanceLog.checked_in_at)
    .where(AttendanceLog.participant_id == Participant.id)
    .correlate_except(AttendanceLog)
    .scalar_subquery()
)

Participant.isTicketReady = column_property(Participant.ticket_img.isnot(None))

Event.hasBoothImage = column_property(Event.booth_image.isnot(None))


class AdminSession(Base):
    __tablename__ = "admin_session"

    id: Mapped[str] = mapped_column(sqlalchemy.String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        sqlalchemy.DateTime(timezone=True), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        sqlalchemy.DateTime(timezone=True), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        sqlalchemy.DateTime(timezone=True), nullable=False
    )
    password_tag: Mapped[str] = mapped_column(sqlalchemy.String(64), nullable=False)
