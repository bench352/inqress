"""add participant detached flag for row tracking sources

Revision ID: e5b1c7a9d3f2
Revises: a2d4e6f8b1c3
Create Date: 2026-10-23

A detached participant keeps its data source row link (so it is still
protected from deletion and from being created again) but the next sync
skips writing its details. Existing rows are not detached.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e5b1c7a9d3f2"
down_revision = "a2d4e6f8b1c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("participant") as batch_op:
        batch_op.add_column(
            sa.Column(
                "detached", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("participant") as batch_op:
        batch_op.drop_column("detached")
