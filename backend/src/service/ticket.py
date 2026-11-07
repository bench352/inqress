import config
import io
import json
import logging
import math
import os
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

import pypdfium2 as pdfium  # type: ignore[import-untyped]
import pyseto
import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from sqlalchemy import select, update
from weasyprint import HTML  # type: ignore[import-untyped]
from weasyprint.text.fonts import FontConfiguration  # type: ignore[import-untyped]

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
_FONTS_DIR = (Path(__file__).resolve().parent.parent / "assets" / "fonts").resolve()
# The template is a bare fragment, so the page box and the body reset belong here.
_PAGE_CSS = """
@page { size: 1440px 2560px; margin: 0 }
html, body { margin: 0; padding: 0 }
"""
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
    # WeasyPrint resolves @font-face URLs from the document base, so a file URL
    # is required here.
    css = css.replace(ph, f"file://{_FONTS_DIR}")
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
    # @font-face rules reach FontConfiguration only when the CSS sits inside the
    # document; a standalone CSS() object is parsed before the fonts register.
    style = f"<style>{_load_ticket_css()}{_PAGE_CSS}</style>"
    template_str = style + _load_ticket_template()

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
                "ticketQR": f"file://{qr_path}",
                "organizationName": organization_name,
                "eventName": event_name,
                "fullName": display_name,
                "eventDate": event_date,
            },
        )

        # PNG has no writer in WeasyPrint, so the page is rasterised instead.
        document = HTML(string=html_str, base_url=f"file://{_FONTS_DIR}/").render(
            font_config=FontConfiguration()
        )
        pdf = pdfium.PdfDocument(document.write_pdf())
        try:
            # 96/72 dpi: one image pixel per CSS pixel, so the card stays 1440x2560.
            pil_image = pdf[0].render(scale=96 / 72).to_pil()
        finally:
            pdf.close()

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


# A finished zip waits on disk until the browser fetches it, then the file is
# removed. One process only, like the SSE job state.
_ZIP_TTL_MINUTES = 30
_zips: dict[uuid.UUID, Path] = {}
# The zip each event is offering for download, so a new export can replace it.
_ready: dict[uuid.UUID, uuid.UUID] = {}
_zips_lock = threading.Lock()


def _store_ticket_zip(event_id: uuid.UUID, path: Path) -> uuid.UUID:
    """Publish a finished zip, replacing the event's previous undownloaded one."""
    download_id = uuid.uuid4()
    with _zips_lock:
        previous = _ready.get(event_id)
        _ready[event_id] = download_id
        _zips[download_id] = path
    if previous is not None:
        _discard_ticket_zip(previous)
    threading.Timer(
        _ZIP_TTL_MINUTES * 60, _discard_ticket_zip, args=(download_id,)
    ).start()
    return download_id


def take_ticket_zip(event_id: uuid.UUID, download_id: uuid.UUID) -> Path | None:
    """Hand the finished zip to the download endpoint."""
    with _zips_lock:
        if _ready.get(event_id) == download_id:
            del _ready[event_id]
        return _zips.pop(download_id, None)


def _discard_ticket_zip(download_id: uuid.UUID) -> None:
    with _zips_lock:
        path = _zips.pop(download_id, None)
        for event_id, ready_id in list(_ready.items()):
            if ready_id == download_id:
                del _ready[event_id]
    if path is not None:
        path.unlink(missing_ok=True)


def _export_zip_task(event_id: uuid.UUID) -> None:
    manager = service.event_stream.event_stream_manager

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

    total = len(participant_rows)
    num_completed = 0
    num_errors = 0
    start_time = time.monotonic()

    def _notify_error(detail: str) -> None:
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.ExportTicketZipErrorData](
                event_type=schema.sse.SseEventType.EXPORT_TICKET_ZIP,
                type=schema.sse.SseType.NOTIFICATION,
                data=schema.sse.ExportTicketZipErrorData(detail=detail),
            ),
        )

    def _send_progress(in_progress: bool = True) -> None:
        est = None
        if in_progress and num_completed > 0:
            elapsed = time.monotonic() - start_time
            est_sec = (elapsed / num_completed) * (total - num_completed)
            est = max(1, math.ceil(est_sec / 60))
        manager.send(
            event_id,
            schema.sse.SseEvent[schema.sse.ExportTicketZipProgressData](
                event_type=schema.sse.SseEventType.EXPORT_TICKET_ZIP,
                type=schema.sse.SseType.PROGRESS,
                data=schema.sse.ExportTicketZipProgressData(
                    in_progress=in_progress,
                    num_completed=num_completed,
                    num_total=total,
                    est_remain_min=est,
                    num_errors=num_errors,
                ),
            ),
            sticky=True,
        )

    if total == 0:
        _send_progress(in_progress=False)
        _notify_error("There are no participants to export")
        return

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        archive_path = Path(tmp.name)

    logger.info("Exporting %d ticket images for event %s", total, event_id)
    _send_progress()

    try:
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for row in participant_rows:
                participant_id, participant_name, participant_title, ticket_token = row

                if not ticket_token:
                    logger.warning(
                        "Skipping participant %s: no ticket token", participant_id
                    )
                    num_errors += 1
                    num_completed += 1
                    _send_progress()
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
                    # Stream the PNG into the archive: no second copy in memory.
                    with zf.open(filename, "w") as entry:
                        entry.write(img_buf.getbuffer())
                except Exception:
                    num_errors += 1
                    logger.warning(
                        "Failed to render ticket for participant %s",
                        participant_id,
                        exc_info=True,
                    )

                num_completed += 1
                _send_progress()
    except Exception as e:
        archive_path.unlink(missing_ok=True)
        _send_progress(in_progress=False)
        _notify_error(str(e))
        logger.exception("Ticket export failed for event %s", event_id)
        return

    _send_progress(in_progress=False)
    # Sticky: a page opened after the export finished still offers the download.
    manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.ExportTicketZipSuccessData](
            event_type=schema.sse.SseEventType.EXPORT_TICKET_ZIP_READY,
            type=schema.sse.SseType.NOTIFICATION,
            data=schema.sse.ExportTicketZipSuccessData(
                download_id=str(_store_ticket_zip(event_id, archive_path))
            ),
        ),
        sticky=True,
    )
    logger.info("Exported %d ticket images for event %s", total, event_id)


def export_zip_and_notify(event_id: uuid.UUID) -> None:
    manager = service.event_stream.event_stream_manager
    try:
        _export_zip_task(event_id)
    finally:
        manager.mark_job_done(event_id, "ticket_zip")
