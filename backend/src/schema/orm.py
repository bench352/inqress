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
    email_subject: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    email_sender_name: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
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
    paseto_private_key: Mapped[str] = mapped_column(sqlalchemy.Text, nullable=False)
    paseto_public_key: Mapped[str] = mapped_column(sqlalchemy.Text, nullable=False)

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
    activated: Mapped[bool | None] = mapped_column(
        sqlalchemy.Boolean,
        nullable=True,
        default=None,
    )
    detached: Mapped[bool] = mapped_column(
        sqlalchemy.Boolean,
        nullable=False,
        default=False,
        server_default=sqlalchemy.false(),
    )
    managed_by_data_source_id: Mapped[uuid.UUID | None] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("data_source.id", ondelete="SET NULL"),
        nullable=True,
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


class DataSource(Base):
    __tablename__ = "data_source"
    __table_args__ = (
        sqlalchemy.UniqueConstraint(
            "event_id", "name", name="uq_data_source_event_name"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sqlalchemy.Uuid, primary_key=True)
    event_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    url: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    headers: Mapped[list[dict[str, str]]] = mapped_column(
        sqlalchemy.JSON, nullable=False, default=list
    )
    sheet_name: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    tracking: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    strategy: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    name_match_mode: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
    activate_new: Mapped[bool] = mapped_column(
        sqlalchemy.Boolean,
        nullable=False,
        default=True,
        server_default=sqlalchemy.true(),
    )
    activated: Mapped[bool] = mapped_column(
        sqlalchemy.Boolean,
        nullable=False,
        default=True,
        server_default=sqlalchemy.true(),
    )
    title_column: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    name_column: Mapped[str] = mapped_column(sqlalchemy.String, nullable=False)
    raw_phone_column: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
    email_column: Mapped[str | None] = mapped_column(sqlalchemy.String, nullable=True)
    last_attempt_at: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
    last_success_at: Mapped[str | None] = mapped_column(
        sqlalchemy.String, nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(sqlalchemy.Text, nullable=True)
    last_summary: Mapped[dict[str, object] | None] = mapped_column(
        sqlalchemy.JSON, nullable=True
    )

    rows: Mapped[list["DataSourceRow"]] = relationship(
        back_populates="data_source", cascade="all, delete-orphan"
    )


class DataSourceRow(Base):
    __tablename__ = "data_source_row"
    __table_args__ = (
        sqlalchemy.UniqueConstraint(
            "data_source_id", "participant_id", name="uq_data_source_row_participant"
        ),
    )

    data_source_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("data_source.id", ondelete="CASCADE"),
        primary_key=True,
    )
    row_number: Mapped[int] = mapped_column(sqlalchemy.Integer, primary_key=True)
    participant_id: Mapped[uuid.UUID] = mapped_column(
        sqlalchemy.Uuid,
        sqlalchemy.ForeignKey("participant.id", ondelete="CASCADE"),
        nullable=False,
    )

    data_source: Mapped["DataSource"] = relationship(back_populates="rows")


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
