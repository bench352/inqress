"""add participant activated flag

Revision ID: b8e4f2a1c9d3
Revises: a7614af7f0da
Create Date: 2026-10-16
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b8e4f2a1c9d3"
down_revision = "a7614af7f0da"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("participant") as batch_op:
        batch_op.add_column(
            sa.Column(
                "activated",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("participant") as batch_op:
        batch_op.drop_column("activated")
