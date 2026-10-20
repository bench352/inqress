"""make participant activated nullable for "to be admitted" state

Revision ID: a2d4e6f8b1c3
Revises: f3b7c1d9e245
Create Date: 2026-10-19
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a2d4e6f8b1c3"
down_revision = "f3b7c1d9e245"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NULL means nobody has decided yet: the participant was imported but not
    # admitted. Existing rows keep their value, so no one is retro-flagged.
    with op.batch_alter_table("participant") as batch_op:
        batch_op.alter_column(
            "activated",
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None,
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE participant SET activated = 1 WHERE activated IS NULL")
    )
    with op.batch_alter_table("participant") as batch_op:
        batch_op.alter_column(
            "activated",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        )
