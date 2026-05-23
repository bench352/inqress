import base64
import logging
import smtplib
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from jinja2 import Template

from env import SmtpSettings

logger = logging.getLogger(__name__)


def _render_template(
    template_str: str, title: str, full_name: str, event_name: str
) -> str:
    template = Template(template_str)
    return template.render(title=title, fullName=full_name, eventName=event_name)


def render_preview_html(
    template_str: str,
    title: str,
    full_name: str,
    event_name: str,
    qr_image_bytes: bytes,
) -> str:
    html = _render_template(template_str, title, full_name, event_name)
    qr_base64 = base64.b64encode(qr_image_bytes).decode()
    return html.replace("cid:qr_code", f"data:image/png;base64,{qr_base64}")


def send_ticket_email(
    to_email: str,
    subject: str,
    template_str: str,
    title: str,
    full_name: str,
    event_name: str,
    qr_image_bytes: bytes,
) -> None:
    settings = SmtpSettings()
    if not settings.smtp_server:
        raise RuntimeError("SMTP is not configured")

    html = _render_template(template_str, title, full_name, event_name)

    msg = MIMEMultipart("related")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_username
    msg["To"] = to_email

    msg.attach(MIMEText(html, "html"))

    img = MIMEImage(qr_image_bytes, "png")
    img.add_header("Content-ID", "<qr_code>")
    img.add_header("Content-Disposition", "inline", filename="ticket.png")
    msg.attach(img)

    with smtplib.SMTP_SSL(
        settings.smtp_server, settings.smtp_port, timeout=30
    ) as server:
        logger.info(
            "Logging in to SMTP server [%s] as [%s]",
            settings.smtp_server,
            settings.smtp_username,
        )
        server.login(settings.smtp_username, settings.smtp_password)
        logger.info("Sending ticket email to [%s]", to_email)
        server.sendmail(settings.smtp_username, to_email, msg.as_string())

    logger.info("Sent ticket email to %s", to_email)
