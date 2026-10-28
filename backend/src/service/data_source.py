import dataclasses
import datetime
import ipaddress
import logging
import socket
import threading
import time
import urllib.parse
import uuid

import httpx
import sqlalchemy.orm
from sqlalchemy import delete, insert, select, update

import config
import schema.enum
import schema.orm
import schema.rest
import schema.sse
import service.db
import service.event_stream
import service.participants
import service.spreadsheet
import service.ticket
import service.uploads

logger = logging.getLogger(__name__)

_FORBIDDEN_HEADERS = {"host", "content-length", "transfer-encoding"}
_TIMEOUT_SECONDS = 60.0
_MAX_REDIRECTS = 5
# The poll loop wakes this often at most, so an edited interval applies promptly.
_WAIT_SLICE_SECONDS = 10.0


@dataclasses.dataclass(frozen=True)
class _Spec:
    """A data source as plain values, so no session is needed while fetching."""

    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    url: str
    headers: list[schema.rest.DataSourceHeader]
    sheet_name: str
    tracking: schema.enum.DataSourceTracking
    strategy: schema.enum.DuplicateStrategy | None
    name_match_mode: schema.enum.NameMatchMode | None
    activate_new: bool
    title_column: str | None
    name_column: str
    raw_phone_column: str | None
    email_column: str | None


@dataclasses.dataclass(frozen=True)
class MappedRow:
    """One data row. None on a field means its column is not in this file."""

    row_number: int
    title: str | None
    name: str
    email: str | None
    raw_phone: str | None


@dataclasses.dataclass(frozen=True)
class RowValues:
    title: str | None
    name: str
    email: str | None
    raw_phone: str | None
    country_code: str | None
    phone: str | None


@dataclasses.dataclass(frozen=True)
class RowCreate:
    row_number: int
    values: RowValues


@dataclasses.dataclass(frozen=True)
class RowUpdate:
    participant_id: uuid.UUID
    values: RowValues


@dataclasses.dataclass(frozen=True)
class ExistingRow:
    """The stored values a row tracking pull can replace."""

    participant_id: uuid.UUID
    title: str | None
    name: str
    email: str | None
    raw_phone: str | None
    country_code: str | None
    phone: str | None
    detached: bool


def _differs(stored: ExistingRow, values: RowValues) -> bool:
    """True when a mapped field this pull can write holds a different value."""
    if stored.name != values.name:
        return True
    if values.title is not None and stored.title != (values.title or None):
        return True
    if values.email is not None and stored.email != (values.email or None):
        return True
    return values.raw_phone is not None and (
        stored.raw_phone != (values.raw_phone or None)
        or stored.country_code != values.country_code
        or stored.phone != values.phone
    )


@dataclasses.dataclass(frozen=True)
class RowPlan:
    creates: list[RowCreate]
    updates: list[RowUpdate]
    skipped: list[int]
    errors: list[str]


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _assert_host_allowed(host: str) -> None:
    """Resolve `host` and refuse internal addresses before any connection.

    Residual risk: a hostile DNS server could answer this check with a public
    IP and the actual connection with a private one (DNS rebinding). Pinning
    connections to the checked IP is not worth the complexity — these links
    are saved by the admin themselves.
    """
    allow_private = config.get_config().app.allow_private_data_sources
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ValueError("The link's host could not be resolved") from e
    for info in infos:
        ip = ipaddress.ip_address(str(info[4][0]).split("%")[0])
        # Link-local covers the cloud metadata address (169.254.169.254) and
        # stays blocked even with the private-range opt-in.
        if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            raise ValueError(
                "The link points to a private or internal address, which is blocked"
            )
        if not ip.is_global and not allow_private:
            raise ValueError(
                "The link points to a private or internal address, which is "
                "blocked. Set app.allow_private_data_sources to true for "
                "LAN-hosted sheets."
            )


def fetch_bytes(
    url: str, headers: list[schema.rest.DataSourceHeader]
) -> tuple[bytes, str]:
    """Download the file. Raises ValueError with something to show the admin."""
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("The link must start with http:// or https://")
    original_host = parsed.hostname
    if not original_host:
        raise ValueError("The link has no host")
    request_headers: dict[str, str] = {}
    for header in headers:
        name = header.name.strip()
        if not name:
            continue
        if name.lower() in _FORBIDDEN_HEADERS:
            raise ValueError(f"The header '{name}' cannot be set on the request")
        request_headers[name] = header.value

    max_bytes = service.uploads.max_upload_bytes()
    current_url = url
    try:
        # Redirects are followed by hand so every hop's host is checked before
        # connecting; custom headers only travel to the original host.
        with httpx.Client(timeout=_TIMEOUT_SECONDS, follow_redirects=False) as client:
            for _ in range(_MAX_REDIRECTS + 1):
                hop = urllib.parse.urlsplit(current_url)
                _assert_host_allowed(hop.hostname or "")
                hop_headers = request_headers if hop.hostname == original_host else {}
                with client.stream("GET", current_url, headers=hop_headers) as response:
                    if (
                        response.status_code in (301, 302, 303, 307, 308)
                        and "location" in response.headers
                    ):
                        current_url = urllib.parse.urljoin(
                            current_url, response.headers["location"]
                        )
                        continue
                    if response.status_code >= 400:
                        raise ValueError(
                            f"The link returned HTTP {response.status_code}"
                        )
                    content_type = response.headers.get("content-type", "")
                    chunks: list[bytes] = []
                    size = 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > max_bytes:
                            raise ValueError(
                                "The file is larger than the configured upload limit"
                            )
                        chunks.append(chunk)
                    return b"".join(chunks), content_type
        raise ValueError("The link has too many redirects")
    except httpx.HTTPError as e:
        # The link can carry a token in its query string. Keep it out of the message
        # the admin sees and out of the log.
        detail = str(e)
        for secret in (url, parsed.query):
            if secret:
                detail = detail.replace(secret, "...")
        raise ValueError(f"Could not download the link: {detail}") from e


def _download_filename(url: str, content_type: str, data: bytes) -> str:
    path = urllib.parse.urlsplit(url).path.lower()
    if path.endswith(".csv"):
        return "data.csv"
    if path.endswith(".xlsx"):
        return "data.xlsx"
    content_type = content_type.lower()
    if "csv" in content_type:
        return "data.csv"
    if "spreadsheet" in content_type or "excel" in content_type:
        return "data.xlsx"
    if data.startswith(b"PK\x03\x04"):
        return "data.xlsx"
    return "data.csv"


def parse_fetched_file(
    data: bytes, content_type: str, url: str
) -> dict[str, tuple[list[str], list[list[str]], int]]:
    if not data.strip():
        raise ValueError("The link returned an empty file")
    head = data[:1024].lstrip().lower()
    if head.startswith(b"<!doctype html") or head.startswith(b"<html"):
        raise ValueError(
            "The link returned a web page, not a CSV or Excel file. "
            "Use a direct download link."
        )
    return service.spreadsheet.parse_workbook(
        data, _download_filename(url, content_type, data)
    )


def preview(
    url: str, headers: list[schema.rest.DataSourceHeader]
) -> schema.rest.DataSourcePreviewResponse:
    data, content_type = fetch_bytes(url, headers)
    workbook = parse_fetched_file(data, content_type, url)
    sheets = {
        name: schema.rest.SheetPreview(columns=columns, heads=rows[:5])
        for name, (columns, rows, _) in workbook.items()
    }
    return schema.rest.DataSourcePreviewResponse(sheets=sheets)


def sheet_columns(
    workbook: dict[str, tuple[list[str], list[list[str]], int]], sheet_name: str
) -> set[str]:
    entry = workbook.get(sheet_name)
    return set(entry[0]) if entry else set()


def map_numbered_rows(
    workbook: dict[str, tuple[list[str], list[list[str]], int]],
    spec: _Spec,
) -> list[MappedRow]:
    """Data rows with sheet-based row numbers (1-based, matching the original spreadsheet)."""
    if spec.sheet_name not in workbook:
        raise ValueError(f"Sheet '{spec.sheet_name}' was not found in the file")
    columns, rows, header_row = workbook[spec.sheet_name]
    if spec.name_column not in columns:
        raise ValueError(
            f"Column '{spec.name_column}' was not found in the file. Check that the "
            "file still has the name column, or save the data source with the "
            "column that holds the names."
        )
    title_index = (
        columns.index(spec.title_column) if spec.title_column in columns else None
    )
    name_index = columns.index(spec.name_column)
    email_index = (
        columns.index(spec.email_column) if spec.email_column in columns else None
    )
    phone_index = (
        columns.index(spec.raw_phone_column)
        if spec.raw_phone_column in columns
        else None
    )

    def _cell(row: list[str], index: int | None) -> str | None:
        if index is None:
            return None
        return row[index].strip() if index < len(row) else ""

    mapped: list[MappedRow] = []
    for offset, row in enumerate(rows):
        sheet_row = header_row + 1 + offset
        mapped.append(
            MappedRow(
                row_number=sheet_row,
                title=_cell(row, title_index),
                name=_cell(row, name_index) or "",
                email=_cell(row, email_index),
                raw_phone=_cell(row, phone_index),
            )
        )
    return mapped


def plan_row_tracking(
    existing: dict[int, ExistingRow],
    rows: list[MappedRow],
    default_region: str,
) -> RowPlan:
    """Decide what a row tracking pull does, without touching the database."""
    creates: list[RowCreate] = []
    updates: list[RowUpdate] = []
    skipped: list[int] = []
    errors: list[str] = []
    for row in rows:
        stored = existing.get(row.row_number)
        if stored is not None and stored.detached:
            # The admin took this person over. Keep the row link, write nothing.
            skipped.append(row.row_number)
            continue
        name = row.name.strip()
        if not name:
            skipped.append(row.row_number)
            continue
        phone_info = service.participants._parse_phone(row.raw_phone, default_region)
        if row.raw_phone and phone_info is None:
            errors.append(f"Row {row.row_number}: Invalid phone number")
            continue
        country_code, phone = phone_info if phone_info else (None, None)
        values = RowValues(
            title=row.title,
            name=name,
            email=row.email,
            raw_phone=row.raw_phone,
            country_code=country_code,
            phone=phone,
        )
        if stored is None:
            creates.append(RowCreate(row_number=row.row_number, values=values))
        elif _differs(stored, values):
            updates.append(
                RowUpdate(participant_id=stored.participant_id, values=values)
            )
    return RowPlan(creates=creates, updates=updates, skipped=skipped, errors=errors)


def _update_values(values: RowValues) -> dict[str, object]:
    """Only the columns mapped and present in this file are written."""
    result: dict[str, object] = {"name": values.name}
    if values.title is not None:
        result["title"] = values.title or None
    if values.email is not None:
        result["email"] = values.email or None
    if values.raw_phone is not None:
        result["raw_phone"] = values.raw_phone or None
        result["country_code"] = values.country_code
        result["phone"] = values.phone
    return result


def _apply_row_tracking(
    spec: _Spec, rows: list[MappedRow]
) -> tuple[schema.rest.DataSourceSummary, list[uuid.UUID]]:
    default_region = config.get_config().app.default_country_code
    with service.db.get_session() as session:
        existing = {
            row_number: ExistingRow(
                participant_id=participant_id,
                title=title,
                name=name,
                email=email,
                raw_phone=raw_phone,
                country_code=country_code,
                phone=phone,
                detached=detached,
            )
            for (
                row_number,
                participant_id,
                title,
                name,
                email,
                raw_phone,
                country_code,
                phone,
                detached,
            ) in session.execute(
                select(
                    schema.orm.DataSourceRow.row_number,
                    schema.orm.DataSourceRow.participant_id,
                    schema.orm.Participant.title,
                    schema.orm.Participant.name,
                    schema.orm.Participant.email,
                    schema.orm.Participant.raw_phone,
                    schema.orm.Participant.country_code,
                    schema.orm.Participant.phone,
                    schema.orm.Participant.detached,
                )
                .join(
                    schema.orm.Participant,
                    schema.orm.Participant.id
                    == schema.orm.DataSourceRow.participant_id,
                )
                .where(schema.orm.DataSourceRow.data_source_id == spec.id)
            ).all()
        }
    plan = plan_row_tracking(existing, rows, default_region)

    created_ids: list[uuid.UUID] = []
    with service.db.get_session() as session:
        private_key = service.ticket.paseto_key(
            session.execute(
                select(schema.orm.Event.paseto_private_key).where(
                    schema.orm.Event.id == spec.event_id
                )
            ).scalar_one()
        )
        for create in plan.creates:
            values = create.values
            participant_id = uuid.uuid4()
            session.execute(
                insert(schema.orm.Participant).values(
                    id=participant_id,
                    event_id=spec.event_id,
                    title=values.title or None,
                    name=values.name,
                    email=values.email or None,
                    raw_phone=values.raw_phone or None,
                    country_code=values.country_code,
                    phone=values.phone,
                    ticket_token=service.ticket.generate_ticket(
                        private_key, spec.event_id, participant_id
                    ),
                    activated=True if spec.activate_new else None,
                    managed_by_data_source_id=spec.id,
                )
            )
            session.execute(
                insert(schema.orm.DataSourceRow).values(
                    data_source_id=spec.id,
                    row_number=create.row_number,
                    participant_id=participant_id,
                )
            )
            created_ids.append(participant_id)
        for row_update in plan.updates:
            session.execute(
                update(schema.orm.Participant)
                .where(schema.orm.Participant.id == row_update.participant_id)
                .values(**_update_values(row_update.values))
            )
        # Rows whose values matched still belong to this source — unless the
        # admin detached them; a detached participant is never (re-)claimed.
        session.execute(
            update(schema.orm.Participant)
            .where(
                schema.orm.Participant.id.in_(
                    select(schema.orm.DataSourceRow.participant_id).where(
                        schema.orm.DataSourceRow.data_source_id == spec.id
                    )
                ),
                schema.orm.Participant.managed_by_data_source_id.is_(None)
                | (schema.orm.Participant.managed_by_data_source_id != spec.id),
                schema.orm.Participant.detached.is_(False),
            )
            .values(managed_by_data_source_id=spec.id)
        )

    summary = schema.rest.DataSourceSummary(
        added=len(plan.creates),
        updated=len(plan.updates),
        skipped=len(plan.skipped),
        errors=len(plan.errors),
        # Every failing row, so the UI can list them all.
        # shortcut: cap this if a source with thousands of bad rows ever bloats
        # the stored summary and the sources response.
        error_samples=plan.errors,
    )
    return summary, created_ids


def _mapped_fields(spec: _Spec, columns: set[str]) -> set[str]:
    fields = {"name"}
    if spec.title_column in columns:
        fields.add("title")
    if spec.email_column in columns:
        fields.add("email")
    if spec.raw_phone_column in columns:
        fields.update({"raw_phone", "country_code", "phone"})
    return fields


def _apply_match(
    spec: _Spec,
    rows: list[MappedRow],
    columns: set[str],
) -> tuple[schema.rest.DataSourceSummary, list[uuid.UUID]]:
    named = [row for row in rows if row.name.strip()]
    payload = [
        schema.rest.ParticipantCreate(
            title=row.title or None,
            name=row.name.strip(),
            email=row.email or None,
            raw_phone=row.raw_phone or None,
        )
        for row in named
    ]
    strategy = spec.strategy or schema.enum.DuplicateStrategy.SKIP
    match_mode = spec.name_match_mode or schema.enum.NameMatchMode.EXACT
    result = service.participants.apply_participant_rows(
        spec.event_id,
        payload,
        strategy,
        match_mode,
        spec.activate_new,
        overwrite_columns=(
            _mapped_fields(spec, columns)
            if strategy is schema.enum.DuplicateStrategy.OVERWRITE
            else None
        ),
        source_id=spec.id,
    )
    row_numbers = {id(person): row.row_number for person, row in zip(payload, named)}
    summary = schema.rest.DataSourceSummary(
        added=len(result.created),
        updated=len(result.overwritten) + len(result.merged),
        skipped=len(result.skipped) + len(rows) - len(named),
        errors=len(result.errors),
        # Every failing row, so the UI can list them all (see _apply_row_tracking).
        error_samples=[
            f"Row {row_numbers[id(error.participant)]}: {error.reason}"
            for error in result.errors
        ],
    )
    return summary, [participant.id for participant in result.created]


def _load_spec(source_id: uuid.UUID) -> _Spec | None:
    with service.db.get_session() as session:
        row = (
            session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.id == source_id
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            return None
        return _Spec(
            id=row.id,
            event_id=row.event_id,
            name=row.name,
            url=row.url,
            headers=[schema.rest.DataSourceHeader(**header) for header in row.headers],
            sheet_name=row.sheet_name,
            tracking=schema.enum.DataSourceTracking(row.tracking),
            strategy=(
                schema.enum.DuplicateStrategy(row.strategy)
                if row.strategy is not None
                else None
            ),
            name_match_mode=(
                schema.enum.NameMatchMode(row.name_match_mode)
                if row.name_match_mode is not None
                else None
            ),
            activate_new=row.activate_new,
            title_column=row.title_column,
            name_column=row.name_column,
            raw_phone_column=row.raw_phone_column,
            email_column=row.email_column,
        )


def _set_attempt(source_id: uuid.UUID) -> None:
    with service.db.get_session() as session:
        session.execute(
            update(schema.orm.DataSource)
            .where(schema.orm.DataSource.id == source_id)
            .values(last_attempt_at=_now())
        )


def _record_failure(source_id: uuid.UUID, message: str) -> None:
    with service.db.get_session() as session:
        session.execute(
            update(schema.orm.DataSource)
            .where(schema.orm.DataSource.id == source_id)
            .values(last_error=message)
        )


def _record_success(
    source_id: uuid.UUID, summary: schema.rest.DataSourceSummary
) -> None:
    with service.db.get_session() as session:
        session.execute(
            update(schema.orm.DataSource)
            .where(schema.orm.DataSource.id == source_id)
            .values(
                last_error=None,
                last_success_at=_now(),
                last_summary=summary.model_dump(by_alias=True),
            )
        )


def _send_sync_event(
    event_id: uuid.UUID,
    source_id: uuid.UUID,
    source_name: str,
    in_progress: bool,
    summary: schema.rest.DataSourceSummary | None = None,
    detail: str | None = None,
) -> None:
    """Tell the UI a sync started (kept for browsers that connect mid-sync) or ended."""
    service.event_stream.event_stream_manager.send(
        event_id,
        schema.sse.SseEvent[schema.sse.DataSourceSyncData](
            event_type=schema.sse.SseEventType.DATA_SOURCE_SYNC,
            type=schema.sse.SseType.PROGRESS,
            data=schema.sse.DataSourceSyncData(
                source_id=str(source_id),
                source_name=source_name,
                in_progress=in_progress,
                added=summary.added if summary else 0,
                updated=summary.updated if summary else 0,
                skipped=summary.skipped if summary else 0,
                errors=summary.errors if summary else 0,
                error_samples=summary.error_samples if summary else [],
                detail=detail,
            ),
        ),
        sticky=in_progress,
    )


def _error_text(error: Exception) -> str:
    text = str(error).strip()
    return text if text else error.__class__.__name__


def sync_source(source_id: uuid.UUID, event_id: uuid.UUID) -> None:
    """Fetch one source and apply it. The caller holds the event's import lock."""
    spec = _load_spec(source_id)
    if spec is None:
        # Deleted before the job ran. Clear the sticky progress without a toast.
        _send_sync_event(event_id, source_id, "", in_progress=False)
        return
    _set_attempt(spec.id)
    _send_sync_event(spec.event_id, spec.id, spec.name, in_progress=True)
    try:
        data, content_type = fetch_bytes(spec.url, spec.headers)
        workbook = parse_fetched_file(data, content_type, spec.url)
        fresh = _load_spec(source_id)
        if fresh is None:
            # Deleted while downloading. Do not apply its rows; just end the job
            # so the "Syncing..." chip clears.
            _send_sync_event(event_id, source_id, "", in_progress=False)
            return
        rows = map_numbered_rows(workbook, fresh)
        if fresh.tracking is schema.enum.DataSourceTracking.ROW:
            summary, created_ids = _apply_row_tracking(fresh, rows)
        else:
            summary, created_ids = _apply_match(
                fresh, rows, sheet_columns(workbook, fresh.sheet_name)
            )
    except Exception as e:
        logger.warning("Data source '%s' sync failed: %s", spec.name, e)
        if _load_spec(spec.id) is None:
            _send_sync_event(event_id, source_id, "", in_progress=False)
            return
        detail = _error_text(e)
        _record_failure(spec.id, detail)
        _send_sync_event(
            spec.event_id, spec.id, spec.name, in_progress=False, detail=detail
        )
        return

    _record_success(spec.id, summary)
    _send_sync_event(
        spec.event_id, spec.id, spec.name, in_progress=False, summary=summary
    )
    if summary.added or summary.updated or summary.skipped or summary.errors:
        logger.info(
            "Data source '%s' synced: %d added, %d updated, %d skipped, %d with errors",
            spec.name,
            summary.added,
            summary.updated,
            summary.skipped,
            summary.errors,
        )
    if created_ids:
        try:
            service.ticket.generate_qrs_task(spec.event_id, created_ids, notify=False)
        except Exception:
            logger.exception(
                "Ticket image generation failed for data source '%s'", spec.name
            )


def run_sync_task(source_id: uuid.UUID, event_id: uuid.UUID) -> None:
    """Save and Sync now call this. They have taken the event's import lock."""
    try:
        sync_source(source_id, event_id)
    finally:
        service.event_stream.event_stream_manager.mark_job_done(event_id, "import")


def _is_due(last_attempt_at: str | None, cutoff: datetime.datetime) -> bool:
    if last_attempt_at is None:
        return True
    try:
        attempted = datetime.datetime.fromisoformat(last_attempt_at)
    except ValueError:
        return True
    if attempted.tzinfo is None:
        attempted = attempted.replace(tzinfo=datetime.timezone.utc)
    return attempted <= cutoff


def _poll_once() -> None:
    # fresh=: the interval is re-read from the file, so the due window must match it.
    minutes = max(1, config.get_config(fresh=True).app.data_source_poll_minutes)
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
        minutes=minutes
    )
    with service.db.get_session() as session:
        due = [
            (row.id, row.event_id)
            for row in session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.activated.is_(True)
                )
            )
            .scalars()
            .all()
            if _is_due(row.last_attempt_at, cutoff)
        ]

    if not due:
        return
    logger.info("Data source poll: %d source(s) due", len(due))

    manager = service.event_stream.event_stream_manager
    for source_id, event_id in due:
        if not manager.mark_job_active(event_id, "import"):
            continue
        try:
            sync_source(source_id, event_id)
        except Exception:
            logger.exception("Data source %s sync failed in a poll cycle", source_id)
        finally:
            manager.mark_job_done(event_id, "import")


def _poll_interval_seconds() -> float:
    """Seconds between poll cycles, re-read from the config file every time."""
    minutes = max(1, config.get_config(fresh=True).app.data_source_poll_minutes)
    return float(minutes * 60)


def _poll_loop(stop: threading.Event) -> None:
    interval = _poll_interval_seconds()
    logger.info(
        "Data source poller started, checking every %d minute(s)", interval // 60
    )
    last_run: float | None = None
    while not stop.is_set():
        if last_run is None or time.monotonic() >= last_run + interval:
            try:
                _poll_once()
            except Exception:
                logger.exception("Data source poll cycle failed")
            last_run = time.monotonic()
        remaining = last_run + interval - time.monotonic()
        # Short waits keep the stop event and a config edit responsive.
        if stop.wait(min(_WAIT_SLICE_SECONDS, max(remaining, 0.0))):
            return
        try:
            refreshed = _poll_interval_seconds()
        except Exception:
            logger.exception("Could not re-read the config; keeping the last interval")
            continue
        if refreshed != interval:
            logger.info(
                "Data source poll interval changed to %d minute(s)", refreshed // 60
            )
            interval = refreshed


def start_poller() -> threading.Event:
    """Start the polling thread. Setting the returned event stops it."""
    stop = threading.Event()
    threading.Thread(
        target=_poll_loop, args=(stop,), name="data-source-poller", daemon=True
    ).start()
    return stop


def _to_response(row: schema.orm.DataSource) -> schema.rest.DataSourceResponse:
    return schema.rest.DataSourceResponse.model_validate(row)


def list_sources(event_id: uuid.UUID) -> list[schema.rest.DataSourceResponse]:
    with service.db.get_session() as session:
        rows = (
            session.execute(
                select(schema.orm.DataSource)
                .where(schema.orm.DataSource.event_id == event_id)
                .order_by(schema.orm.DataSource.name)
            )
            .scalars()
            .all()
        )
        return [_to_response(row) for row in rows]


def get_source(
    event_id: uuid.UUID, source_id: uuid.UUID
) -> schema.rest.DataSourceResponse | None:
    with service.db.get_session() as session:
        row = (
            session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.id == source_id,
                    schema.orm.DataSource.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        return _to_response(row) if row is not None else None


def has_row_links(source_id: uuid.UUID) -> bool:
    with service.db.get_session() as session:
        return (
            session.execute(
                select(schema.orm.DataSourceRow.row_number)
                .where(schema.orm.DataSourceRow.data_source_id == source_id)
                .limit(1)
            ).first()
            is not None
        )


def _ensure_name_free(
    session: sqlalchemy.orm.Session,
    event_id: uuid.UUID,
    name: str,
    exclude_id: uuid.UUID | None,
) -> None:
    query = select(schema.orm.DataSource.id).where(
        schema.orm.DataSource.event_id == event_id,
        schema.orm.DataSource.name == name,
    )
    if exclude_id is not None:
        query = query.where(schema.orm.DataSource.id != exclude_id)
    if session.execute(query).first() is not None:
        raise ValueError("A data source with this name already exists")


def _values(payload: schema.rest.DataSourceBase) -> dict:
    values = payload.model_dump(exclude={"clear_row_links"})
    values["name"] = values["name"].strip()
    values["sheet_name"] = values["sheet_name"].strip()
    if values["tracking"] == schema.enum.DataSourceTracking.ROW:
        values["strategy"] = None
        values["name_match_mode"] = None
    return values


def create_source(
    event_id: uuid.UUID, payload: schema.rest.DataSourceCreate
) -> schema.rest.DataSourceResponse:
    values = _values(payload)
    values["url"] = payload.url.strip()
    with service.db.get_session() as session:
        _ensure_name_free(session, event_id, values["name"], None)
        row = schema.orm.DataSource(id=uuid.uuid4(), event_id=event_id, **values)
        session.add(row)
        session.flush()
        return _to_response(row)


def update_source(
    event_id: uuid.UUID, source_id: uuid.UUID, payload: schema.rest.DataSourceUpdate
) -> schema.rest.DataSourceResponse | None:
    values = _values(payload)
    with service.db.get_session() as session:
        row = (
            session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.id == source_id,
                    schema.orm.DataSource.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            return None
        _ensure_name_free(session, event_id, values["name"], source_id)
        if payload.clear_row_links:
            session.execute(
                delete(schema.orm.DataSourceRow).where(
                    schema.orm.DataSourceRow.data_source_id == source_id
                )
            )
        for key, value in values.items():
            setattr(row, key, value)
        session.flush()
        return _to_response(row)


def delete_source(event_id: uuid.UUID, source_id: uuid.UUID) -> bool:
    with service.db.get_session() as session:
        row = (
            session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.id == source_id,
                    schema.orm.DataSource.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            return False
        session.delete(row)
        return True


def set_activated(
    event_id: uuid.UUID, source_id: uuid.UUID, activated: bool
) -> schema.rest.DataSourceResponse | None:
    with service.db.get_session() as session:
        row = (
            session.execute(
                select(schema.orm.DataSource).where(
                    schema.orm.DataSource.id == source_id,
                    schema.orm.DataSource.event_id == event_id,
                )
            )
            .scalars()
            .first()
        )
        if row is None:
            return None
        row.activated = activated
        session.flush()
        return _to_response(row)
