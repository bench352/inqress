import html
import re
import urllib.parse

from markdown_it import MarkdownIt

_TOKEN = re.compile(r"\{\{\s*([A-Za-z]+)\s*\}\}")
_QR_PARAGRAPH = re.compile(r"<p>\s*\{\{\s*ticketQR\s*\}\}\s*</p>")

TICKET_QR_HTML = (
    '<p style="text-align: center; margin: 20px 0;">'
    '<img src="cid:qr_code" alt="Your QR Code Ticket" '
    'style="max-width: 320px; border: 2px solid #ddd; padding: 12px; border-radius: 8px;"/>'
    "</p>"
)

_LINK = re.compile(r'<a href="([^"]*)"[^>]*>(.*?)</a>', re.DOTALL)
_BR = re.compile(r"<br\s*/?>\n?")
_LIST_ITEM = re.compile(r"<li[^>]*>(.*?)</li>\s*", re.DOTALL)
_ITEM_PARAGRAPH = re.compile(r"\n{2,}")
_BLOCK_END = re.compile(r"</(?:p|h[1-6]|blockquote|div|ul|ol|pre|table)>")
_TAG = re.compile(r"<[^>]+>")
_BLANK_RUN = re.compile(r"\n{3,}")

_EMAIL_SHELL = """<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
{body}
<hr>
<p style="font-size: 0.9em; color: #777;">This email was sent automatically by <strong>InQRess</strong>, an open-source QR ticketing system.</p>
</body>
</html>
"""


def _allowed_link(url: str) -> bool:
    parsed = urllib.parse.urlparse(url.strip())
    return parsed.scheme in {"http", "https", "mailto"}


class _SafeMarkdown(MarkdownIt):
    def validateLink(self, url: str) -> bool:
        return _allowed_link(url)


def _markdown() -> MarkdownIt:
    return _SafeMarkdown("commonmark", {"html": False, "linkify": False})


def fill_placeholders(
    template: str,
    values: dict[str, str],
    raw: frozenset[str] = frozenset(),
) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            return match.group(0)
        if key in raw:
            return values[key]
        return html.escape(values[key], quote=True)

    return _TOKEN.sub(repl, template)


def render_email_html(
    template: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
) -> str:
    rendered = _markdown().render(template)
    rendered = _QR_PARAGRAPH.sub(TICKET_QR_HTML, rendered)
    body = fill_placeholders(
        rendered,
        {
            "title": title or "",
            "fullName": full_name,
            "eventName": event_name,
            "senderName": sender_name,
            "ticketQR": TICKET_QR_HTML,
        },
        raw=frozenset({"ticketQR"}),
    )
    return _EMAIL_SHELL.format(body=body)


def _html_to_text(fragment: str) -> str:
    def repl_link(match: re.Match[str]) -> str:
        url, label = match.group(1), match.group(2)
        return label if label == url else f"{label} ({url})"

    def repl_item(match: re.Match[str]) -> str:
        # Every item becomes a bullet: plain text has no numbering of its own.
        item = _ITEM_PARAGRAPH.sub("\n", _TAG.sub("", match.group(1)).strip())
        return f"- {item}\n" if item else ""

    text = _LINK.sub(repl_link, fragment)
    text = _BR.sub("\n", text)
    text = _LIST_ITEM.sub(repl_item, text)
    text = _BLOCK_END.sub("\n\n", text)
    text = _TAG.sub("", text)
    text = html.unescape(text)
    return _BLANK_RUN.sub("\n\n", text).strip()


def render_message_text(
    template: str,
    title: str | None,
    full_name: str,
    event_name: str,
    sender_name: str,
) -> str:
    rendered = _markdown().render(template)
    rendered = _QR_PARAGRAPH.sub("", rendered)
    values = {
        "title": title or "",
        "fullName": full_name,
        "eventName": event_name,
        "senderName": sender_name,
        "ticketQR": "",
    }
    # The QR travels as the ticket image, so the placeholder disappears.
    return fill_placeholders(_html_to_text(rendered), values, raw=frozenset(values))
