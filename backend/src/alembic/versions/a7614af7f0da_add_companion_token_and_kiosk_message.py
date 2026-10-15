"""add companion_token and kiosk_message

Revision ID: a7614af7f0da
Revises: d9e3c4d5e6f7
Create Date: 2026-10-14
"""

import secrets

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7614af7f0da"
down_revision = "d9e3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns as nullable first
    with op.batch_alter_table("event") as batch_op:
        batch_op.add_column(sa.Column("companion_token", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("kiosk_message", sa.Text(), nullable=True))

    # Backfill
    conn = op.get_bind()
    events = conn.execute(sa.text("SELECT id FROM event")).fetchall()
    for (eid,) in events:
        token = secrets.token_urlsafe(32)
        conn.execute(
            sa.text(
                "UPDATE event SET companion_token = :t, kiosk_message = '' WHERE id = :id"
            ),
            {"t": token, "id": eid},
        )

    # Make not null + unique for token
    with op.batch_alter_table("event") as batch_op:
        batch_op.alter_column("companion_token", nullable=False)
        batch_op.alter_column("kiosk_message", nullable=False, server_default="")
        batch_op.create_unique_constraint(
            "uq_event_companion_token", ["companion_token"]
        )


def downgrade() -> None:
    with op.batch_alter_table("event") as batch_op:
        batch_op.drop_constraint("uq_event_companion_token", type_="unique")
        batch_op.drop_column("kiosk_message")
        batch_op.drop_column("companion_token")
