import io
import json
import logging
import math
import time
import uuid
from pathlib import Path

import qrcode
import pyseto
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from sqlalchemy import select, update

from schema.orm import Attendee
from schema.service import TicketPayload
from schema.sse import (
    GenerateTicketQrErrorData,
    GenerateTicketQrProgressData,
    GenerateTicketQrSuccessData,
    SseEvent,
    SseEventType,
    SseType,
)
from service.db import get_session
from service.event_stream import EventStreamManager

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_KEY_PATH = _DATA_DIR / "key.pem"
_PUB_PATH = _DATA_DIR / "pub.pem"

_DATA_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

_private_key: pyseto.KeyInterface | None = None
_public_key: pyseto.KeyInterface | None = None


def init_keys() -> None:
    global _private_key, _public_key

    if _KEY_PATH.exists() and _PUB_PATH.exists():
        logger.info("Loading existing PASETO keys from %s", _DATA_DIR)
        _private_key = pyseto.Key.new(
            version=2, purpose="public", key=_KEY_PATH.read_bytes()
        )
        _public_key = pyseto.Key.new(
            version=2, purpose="public", key=_PUB_PATH.read_bytes()
        )
    else:
        logger.info("Generating new PASETO Ed25519 key pair")
        private = ed25519.Ed25519PrivateKey.generate()
        public = private.public_key()

        private_pem = private.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_pem = public.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        _KEY_PATH.write_bytes(private_pem)
        _PUB_PATH.write_bytes(public_pem)

        _private_key = pyseto.Key.new(version=2, purpose="public", key=private_pem)
        _public_key = pyseto.Key.new(version=2, purpose="public", key=public_pem)


def verify_ticket(token_str: str) -> TicketPayload:
    assert _public_key is not None, "Keys not initialized"
    try:
        decoded = pyseto.decode(_public_key, token_str)
        payload = json.loads(decoded.payload)
        return TicketPayload(
            event_id=uuid.UUID(payload["eventId"]),
            attendee_id=uuid.UUID(payload["attendeeId"]),
        )
    except Exception as e:
        raise ValueError("Not a valid ticket.") from e


def generate_ticket(event_id: uuid.UUID, attendee_id: uuid.UUID) -> str:
    assert _private_key is not None, "Keys not initialized"
    payload = TicketPayload(event_id=event_id, attendee_id=attendee_id)
    token = pyseto.encode(
        _private_key,
        {"eventId": str(payload.event_id), "attendeeId": str(payload.attendee_id)},
    )
    return token.decode()


def generate_qrs_task(
    event_id: uuid.UUID,
    attendee_ids: list[uuid.UUID],
) -> None:
    manager = EventStreamManager()
    total = len(attendee_ids)
    if total == 0:
        manager.send(
            event_id,
            SseEvent[GenerateTicketQrSuccessData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.NOTIFICATION,
                data=GenerateTicketQrSuccessData(),
            ),
        )
        return

    num_completed = 0
    num_errors = 0
    start_time = time.monotonic()

    def _notify_error(detail: str) -> None:
        manager.send(
            event_id,
            SseEvent[GenerateTicketQrErrorData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.NOTIFICATION,
                data=GenerateTicketQrErrorData(detail=detail),
            ),
        )

    def _send_progress():
        est = None
        if num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            SseEvent[GenerateTicketQrProgressData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.PROGRESS,
                data=GenerateTicketQrProgressData(
                    in_progress=True,
                    num_completed=num_completed,
                    num_total=total,
                    est_remain_min=est,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

    try:
        for i, attendee_id in enumerate(attendee_ids):
            _send_progress()

            try:
                with get_session() as session:
                    attendee = (
                        session.execute(
                            select(Attendee).where(
                                Attendee.id == attendee_id,
                                Attendee.event_id == event_id,
                            )
                        )
                        .scalars()
                        .first()
                    )

                    if attendee is None:
                        logger.warning(
                            "Attendee %s not found, skipping (%d/%d)",
                            attendee_id,
                            i + 1,
                            total,
                        )
                        num_errors += 1
                        _notify_error(f"Attendee {attendee_id} not found")
                        num_completed += 1
                        continue

                    if not attendee.ticket_token:
                        logger.warning(
                            "Attendee %s has no ticket token, skipping (%d/%d)",
                            attendee_id,
                            i + 1,
                            total,
                        )
                        num_errors += 1
                        _notify_error(
                            f"No ticket token for {attendee.title} {attendee.name}"
                        )
                        num_completed += 1
                        continue

                    img = qrcode.make(attendee.ticket_token)
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")

                    session.execute(
                        update(Attendee)
                        .where(Attendee.id == attendee_id)
                        .values(ticket_img=buf.getvalue())
                    )

                    logger.info(
                        "Generated ticket QR for %s (%d/%d)",
                        attendee.email,
                        i + 1,
                        total,
                    )
            except Exception:
                logger.exception(
                    "Failed to generate ticket QR for attendee %s (%d/%d)",
                    attendee_id,
                    i + 1,
                    total,
                )
                num_errors += 1
                _notify_error(f"Failed to generate QR for attendee {attendee_id}")

            num_completed += 1

        manager.send(
            event_id,
            SseEvent[GenerateTicketQrProgressData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.PROGRESS,
                data=GenerateTicketQrProgressData(
                    in_progress=False,
                    num_completed=num_completed,
                    num_total=total,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

        manager.send(
            event_id,
            SseEvent[GenerateTicketQrSuccessData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.NOTIFICATION,
                data=GenerateTicketQrSuccessData(),
            ),
        )

        logger.info(
            "Ticket QR generation completed for event %s (%d attendees)",
            event_id,
            total,
        )

    except Exception as e:
        logger.exception("Ticket QR generation failed for event %s", event_id)

        manager.send(
            event_id,
            SseEvent[GenerateTicketQrProgressData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.PROGRESS,
                data=GenerateTicketQrProgressData(
                    in_progress=False,
                    num_completed=num_completed,
                    num_total=total,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

        manager.send(
            event_id,
            SseEvent[GenerateTicketQrErrorData](
                event_type=SseEventType.GENERATE_TICKET_QR,
                type=SseType.NOTIFICATION,
                data=GenerateTicketQrErrorData(detail=str(e)),
            ),
        )


def generate_qrs_and_notify(
    event_id: uuid.UUID,
    attendee_ids: list[uuid.UUID],
) -> None:
    manager = EventStreamManager()
    try:
        generate_qrs_task(event_id, attendee_ids)
    finally:
        manager.mark_job_done(event_id, "ticket_qr")
