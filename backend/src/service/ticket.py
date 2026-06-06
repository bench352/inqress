import io
import json
import logging
import math
import time
import uuid
from pathlib import Path
from typing import Any

import pyseto
import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from sqlalchemy import select, update

import schema.orm
import schema.service
import schema.sse
import service.db
import service.event_stream

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


def verify_ticket(token_str: str) -> schema.service.TicketPayload:
    assert _public_key is not None, "Keys not initialized"
    try:
        decoded = pyseto.decode(_public_key, token_str)
        raw = decoded.payload
        payload: dict[str, Any] = json.loads(raw) if isinstance(raw, bytes) else raw
        return schema.service.TicketPayload(
            event_id=uuid.UUID(payload["eventId"]),
            participant_id=uuid.UUID(payload["participantId"]),
        )
    except Exception as e:
        raise ValueError("Not a valid ticket.") from e


def generate_ticket(event_id: uuid.UUID, participant_id: uuid.UUID) -> str:
    assert _private_key is not None, "Keys not initialized"
    payload = schema.service.TicketPayload(
        event_id=event_id, participant_id=participant_id
    )
    token = pyseto.encode(
        _private_key,
        {
            "eventId": str(payload.event_id),
            "participantId": str(payload.participant_id),
        },
    )
    return token.decode()


def generate_qrs_task(
    event_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
) -> None:
    manager = service.event_stream.event_stream_manager
    total = len(participant_ids)
    if total == 0:
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.GenerateTicketQrSuccessData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.GenerateTicketQrSuccessData(),
            ),
        )
        return

    num_completed = 0
    num_errors = 0
    start_time = time.monotonic()

    def _notify_error(detail: str) -> None:
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.GenerateTicketQrErrorData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.GenerateTicketQrErrorData(detail=detail),
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
            schema.sse.SseEvent[schema.sse.GenerateTicketQrProgressData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.GenerateTicketQrProgressData(
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
        for i, participant_id in enumerate(participant_ids):
            _send_progress()

            try:
                with service.db.get_session() as session:
                    participant = (
                        session.execute(
                            select(schema.orm.Participant).where(
                                schema.orm.Participant.id == participant_id,
                                schema.orm.Participant.event_id == event_id,
                            )
                        )
                        .scalars()
                        .first()
                    )

                    if participant is None:
                        logger.warning(
                            "Participant %s not found, skipping (%d/%d)",
                            participant_id,
                            i + 1,
                            total,
                        )
                        num_errors += 1
                        _notify_error(f"Participant {participant_id} not found")
                        num_completed += 1
                        continue

                    if not participant.ticket_token:
                        logger.warning(
                            "Participant %s has no ticket token, skipping (%d/%d)",
                            participant_id,
                            i + 1,
                            total,
                        )
                        num_errors += 1
                        _notify_error(
                            f"No ticket token for {participant.title} {participant.name}"
                        )
                        num_completed += 1
                        continue

                    img = qrcode.make(participant.ticket_token)
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")  # type: ignore[call-arg]

                    session.execute(
                        update(schema.orm.Participant)
                        .where(schema.orm.Participant.id == participant_id)
                        .values(ticket_img=buf.getvalue())
                    )

                    logger.info(
                        "Generated ticket QR for %s (%d/%d)",
                        participant.email or participant.name,
                        i + 1,
                        total,
                    )
            except Exception:
                logger.exception(
                    "Failed to generate ticket QR for participant %s (%d/%d)",
                    participant_id,
                    i + 1,
                    total,
                )
                num_errors += 1
                _notify_error(f"Failed to generate QR for participant {participant_id}")

            num_completed += 1

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.GenerateTicketQrProgressData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.GenerateTicketQrProgressData(
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
            schema.sse.SseEvent[schema.sse.GenerateTicketQrSuccessData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.GenerateTicketQrSuccessData(),
            ),
        )

        logger.info(
            "Ticket QR generation completed for event %s (%d participants)",
            event_id,
            total,
        )

    except Exception as e:
        logger.exception("Ticket QR generation failed for event %s", event_id)

        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.GenerateTicketQrProgressData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.GenerateTicketQrProgressData(
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
            schema.sse.SseEvent[schema.sse.GenerateTicketQrErrorData](
                event_type=schema.sse.SseEventType.GENERATE_TICKET_QR,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.GenerateTicketQrErrorData(detail=str(e)),
            ),
        )


def generate_qrs_and_notify(
    event_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
) -> None:
    manager = service.event_stream.event_stream_manager
    try:
        generate_qrs_task(event_id, participant_ids)
    finally:
        manager.mark_job_done(event_id, "ticket_qr")
