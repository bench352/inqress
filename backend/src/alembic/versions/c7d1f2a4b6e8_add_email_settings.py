"""add per-event email settings

Revision ID: c7d1f2a4b6e8
Revises: e5b1c7a9d3f2
Create Date: 2026-10-25
"""

from alembic import op
import sqlalchemy as sa


revision = "c7d1f2a4b6e8"
down_revision = "e5b1c7a9d3f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("event") as batch_op:
        batch_op.add_column(sa.Column("email_subject", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("email_sender_name", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("event") as batch_op:
        batch_op.drop_column("email_sender_name")
        batch_op.drop_column("email_subject")
