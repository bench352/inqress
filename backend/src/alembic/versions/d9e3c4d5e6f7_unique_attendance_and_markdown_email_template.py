"""unique attendance per participant and replace stored email templates with markdown

Revision ID: d9e3c4d5e6f7
Revises: 9f2c3d4e5f6a
Create Date: 2026-10-13

Keeps the earliest check-in when duplicates already exist, then rejects
a second check-in for the same participant.

Saved HTML templates are replaced with the markdown default. New events
already load the markdown file. Old templates are not kept.
"""

import pathlib
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d9e3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "9f2c3d4e5f6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Deduplicate attendance_log, keeping the earliest check-in per (event, participant)
    op.execute(
        """
        DELETE FROM attendance_log
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY event_id, participant_id
                            ORDER BY is_test ASC, checked_in_at ASC, id ASC
                       ) AS rn
                FROM attendance_log
            )
            WHERE rn = 1
        )
        """
    )
    with op.batch_alter_table("attendance_log") as batch:
        batch.create_unique_constraint(
            "uq_attendance_event_participant",
            ["event_id", "participant_id"],
        )

    # Replace all existing email templates with the markdown default.
    # (New events load the markdown asset directly.)
    template_path = (
        pathlib.Path(__file__).resolve().parents[2]
        / "assets"
        / "default_email_template.md"
    )
    text = template_path.read_text()
    op.get_bind().execute(
        sa.text("UPDATE event SET email_template = :text"),
        {"text": text},
    )


def downgrade() -> None:
    with op.batch_alter_table("attendance_log") as batch:
        batch.drop_constraint("uq_attendance_event_participant", type_="unique")
