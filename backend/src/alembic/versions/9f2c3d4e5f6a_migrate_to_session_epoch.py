"""add admin_session + migrate password_tag to session epoch

Revision ID: 9f2c3d4e5f6a
Revises: ad4d1efc7092
Create Date: 2026-10-10

Creates the admin_session table and documents that the password_tag
column is now used to store a random epoch identifier (instead of a
password hash). Session invalidation on password change is driven by
the .admin_session_epoch file in the data directory.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f2c3d4e5f6a"
down_revision: Union[str, Sequence[str], None] = "ad4d1efc7092"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "admin_session" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "admin_session",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("password_tag", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("admin_session")
