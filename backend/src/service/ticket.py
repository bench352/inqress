import config
import io
import json
import logging
import math
import os
import tempfile
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

import pyseto
import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from html2pic import Html2Pic  # type: ignore[import-untyped]
from sqlalchemy import select, update

import schema.orm
import schema.service
import schema.sse
import service.db
import service.event_stream
import service.filenames
import service.markup

# For bulk QR ticket export
_TICKET_TEMPLATE_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "ticket_template.html"
)
_TICKET_CSS_PATH = (
    Path(__file__).resolve().parent.parent / "assets" / "ticket_template.css"
)
logger = logging.getLogger(__name__)


def generate_key_pair() -> schema.service.TicketKeyPair:
    """A fresh key pair for a new event."""
    private = ed25519.Ed25519PrivateKey.generate()
    private_pem = private.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = private.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return schema.service.TicketKeyPair(
        private_pem=private_pem.decode(), public_pem=public_pem.decode()
    )


def paseto_key(pem: str) -> pyseto.KeyInterface:
    """Build a key from a PEM. Parsing is not free, so build once per job."""
    return pyseto.Key.new(version=2, purpose="public", key=pem.encode())


def verify_ticket(public_key_pem: str, token_str: str) -> schema.service.TicketPayload:
    try:
        decoded = pyseto.decode(paseto_key(public_key_pem), token_str)
        raw = decoded.payload
        payload: dict[str, Any] = json.loads(raw) if isinstance(raw, bytes) else raw
        return schema.service.TicketPayload(
            event_id=uuid.UUID(payload["eventId"]),
            participant_id=uuid.UUID(payload["participantId"]),
        )
    except Exception as e:
        raise ValueError("Not a valid ticket.") from e


def generate_ticket(
    private_key: pyseto.KeyInterface, event_id: uuid.UUID, participant_id: uuid.UUID
) -> str:
    payload = schema.service.TicketPayload(
        event_id=event_id, participant_id=participant_id
    )
    token = pyseto.encode(
        private_key,
        {
            "eventId": str(payload.event_id),
            "participantId": str(payload.participant_id),
        },
    )
    return token.decode()


class _QuietStreamManager:
    """Drops progress notifications, for background work that must stay silent."""

    def send(self, *args: Any, **kwargs: Any) -> None:
        pass


def generate_qrs_task(
    event_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
    notify: bool = True,
) -> None:
    manager: Any = (
        service.event_stream.event_stream_manager if notify else _QuietStreamManager()
    )
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


def _load_ticket_template() -> str:
    return _TICKET_TEMPLATE_PATH.read_text()


def _load_ticket_css() -> str:
    css = _TICKET_CSS_PATH.read_text()
    ph = "ASSETS_PATH_PLACEHOLDER"
    if ph not in css:
        return css
    fonts_dir = str(
        (Path(__file__).resolve().parent.parent / "assets" / "fonts").resolve()
    )
    css = css.replace(ph, fonts_dir)
    return css


def _render_ticket_image(
    event_name: str,
    event_date: str,
    participant_id: uuid.UUID,
    participant_name: str,
    participant_title: str | None,
    ticket_token: str,
    organization_name: str,
) -> io.BytesIO:
    template_str = _load_ticket_template()
    css = _load_ticket_css()

    # Generate QR to fit inside the white 1440px square with 60px padding on all sides.
    # The white container + padding gives scanners a reliable quiet zone.
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=1,
        border=2,
    )
    qr.add_data(ticket_token)
    qr.make(fit=True)
    modules = qr.modules_count + 4
    if modules > 0:
        qr.box_size = max(1, 1320 // modules)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    qr_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            qr_img.save(tmp, format="PNG")  # type: ignore[call-arg]
            qr_path = tmp.name

        display_name = (
            f"{participant_title} {participant_name}".strip()
            if participant_title
            else participant_name
        )

        html_str = service.markup.fill_placeholders(
            template_str,
            {
                "ticketQR": qr_path,
                "organizationName": organization_name,
                "eventName": event_name,
                "fullName": display_name,
                "eventDate": event_date,
            },
        )

        renderer = Html2Pic(html_str, css)
        image = renderer.render()
        pil_image = image.to_pillow()

        img_buf = io.BytesIO()
        pil_image.save(img_buf, format="PNG")  # type: ignore
        img_buf.seek(0)
        return img_buf
    finally:
        if qr_path is not None:
            os.unlink(qr_path)


def generate_single_ticket_image(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> tuple[io.BytesIO, str]:
    with service.db.get_session() as session:
        event = (
            session.execute(
                select(schema.orm.Event).where(schema.orm.Event.id == event_id)
            )
            .scalars()
            .first()
        )
        if event is None:
            raise ValueError("Event not found")

        event_name = event.name
        event_date = event.date

        participant = session.execute(
            select(
                schema.orm.Participant.id,
                schema.orm.Participant.name,
                schema.orm.Participant.title,
                schema.orm.Participant.ticket_token,
            ).where(
                schema.orm.Participant.id == participant_id,
                schema.orm.Participant.event_id == event_id,
            )
        ).first()
        if participant is None:
            raise ValueError("Participant not found")

        p_id, p_name, p_title, p_token = participant
        if not p_token:
            raise ValueError("Participant has no ticket token")

    cfg = config.get_config()
    organization_name = cfg.app.organization_name or ""
    safe_name = service.filenames.safe_name(p_name)

    img_bytes = _render_ticket_image(
        event_name,
        event_date,
        p_id,
        p_name,
        p_title,
        p_token,
        organization_name,
    )

    return img_bytes, safe_name


def export_ticket_images_zip(event_id: uuid.UUID) -> io.BytesIO:
    with service.db.get_session() as session:
        event = (
            session.execute(
                select(schema.orm.Event).where(schema.orm.Event.id == event_id)
            )
            .scalars()
            .first()
        )
        if event is None:
            raise ValueError("Event not found")

        event_name = event.name
        event_date = event.date

        participant_rows = session.execute(
            select(
                schema.orm.Participant.id,
                schema.orm.Participant.name,
                schema.orm.Participant.title,
                schema.orm.Participant.ticket_token,
            ).where(schema.orm.Participant.event_id == event_id)
        ).all()

    cfg = config.get_config()
    organization_name = cfg.app.organization_name or ""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in participant_rows:
            participant_id, participant_name, participant_title, ticket_token = row

            if not ticket_token:
                logger.warning(
                    "Skipping participant %s: no ticket token", participant_id
                )
                continue

            try:
                img_buf = _render_ticket_image(
                    event_name,
                    event_date,
                    participant_id,
                    participant_name,
                    participant_title,
                    ticket_token,
                    organization_name,
                )
                filename = f"{service.filenames.safe_name(participant_name)} - {participant_id}.png"
                zf.writestr(filename, img_buf.getvalue())
            except Exception:
                logger.warning(
                    "Failed to render ticket for participant %s",
                    participant_id,
                    exc_info=True,
                )

    buf.seek(0)
    return buf
