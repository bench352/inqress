import io
import json
import logging
import uuid
from pathlib import Path

import qrcode
import pyseto
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from sqlalchemy import select, update, null

from schema.orm import Attendee
from schema.service import TicketPayload
from service.db import get_engine

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

        _private_key = pyseto.Key.new(
            version=2, purpose="public", key=private_pem
        )
        _public_key = pyseto.Key.new(
            version=2, purpose="public", key=public_pem
        )


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
        raise ValueError(f"Invalid ticket: {e}")


def generate_ticket(event_id: uuid.UUID, attendee_id: uuid.UUID) -> str:
    assert _private_key is not None, "Keys not initialized"
    payload = TicketPayload(event_id=event_id, attendee_id=attendee_id)
    token = pyseto.encode(
        _private_key,
        {"eventId": str(payload.event_id), "attendeeId": str(payload.attendee_id)},
    )
    return token.decode()


def generate_ticket_images(event_id: uuid.UUID | None = None) -> int:
    with get_engine().begin() as conn:
        stmt = select(Attendee.id, Attendee.ticket_token).where(
            Attendee.ticket_img == null()
        )
        if event_id is not None:
            stmt = stmt.where(Attendee.event_id == event_id)

        rows = conn.execute(stmt).mappings().all()

        count = 0
        for row in rows:
            img = qrcode.make(row["ticket_token"])
            buf = io.BytesIO()
            img.save(buf, format="PNG")

            conn.execute(
                update(Attendee)
                .where(Attendee.id == row["id"])
                .values(ticket_img=buf.getvalue())
            )
            count += 1

        logger.info("Generated ticket images for %d attendees", count)
        return count
