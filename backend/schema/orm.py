from sqlalchemy import ForeignKey, String, Text, LargeBinary, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "event"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date: Mapped[str] = mapped_column(String, nullable=False)
    mode: Mapped[str] = mapped_column(String, nullable=False, default="disabled")

    attendees: Mapped[list["Attendee"]] = relationship(back_populates="event")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="event"
    )


class Attendee(Base):
    __tablename__ = "attendee"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("event.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    raw_phone: Mapped[str | None] = mapped_column(String)
    country_code: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    ticket_token: Mapped[str] = mapped_column(String, nullable=False)
    ticket_img: Mapped[bytes | None] = mapped_column(LargeBinary)

    event: Mapped["Event"] = relationship(back_populates="attendees")
    attendance_logs: Mapped[list["AttendanceLog"]] = relationship(
        back_populates="attendee"
    )


class AttendanceLog(Base):
    __tablename__ = "attendance_log"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("event.id"), nullable=False)
    attendee_id: Mapped[str] = mapped_column(ForeignKey("attendee.id"), nullable=False)
    checked_in_at: Mapped[str] = mapped_column(String, nullable=False)
    method: Mapped[str] = mapped_column(String, nullable=False)
    device_info: Mapped[str | None] = mapped_column(Text)
    is_test: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    event: Mapped["Event"] = relationship(back_populates="attendance_logs")
    attendee: Mapped["Attendee"] = relationship(back_populates="attendance_logs")
