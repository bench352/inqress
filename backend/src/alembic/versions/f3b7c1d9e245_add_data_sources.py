"""add data sources for automated participant sync

Revision ID: f3b7c1d9e245
Revises: c4a9e21f7b3d
Create Date: 2026-10-18
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f3b7c1d9e245"
down_revision = "c4a9e21f7b3d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "data_source",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("headers", sa.JSON(), nullable=False),
        sa.Column("sheet_name", sa.String(), nullable=False),
        sa.Column("tracking", sa.String(), nullable=False),
        sa.Column("strategy", sa.String(), nullable=True),
        sa.Column("name_match_mode", sa.String(), nullable=True),
        sa.Column(
            "activate_new", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("activated", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("title_column", sa.String(), nullable=True),
        sa.Column("name_column", sa.String(), nullable=False),
        sa.Column("raw_phone_column", sa.String(), nullable=True),
        sa.Column("email_column", sa.String(), nullable=True),
        sa.Column("last_attempt_at", sa.String(), nullable=True),
        sa.Column("last_success_at", sa.String(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_summary", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["event.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "name", name="uq_data_source_event_name"),
    )
    op.create_table(
        "data_source_row",
        sa.Column("data_source_id", sa.Uuid(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["data_source_id"], ["data_source.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["participant_id"], ["participant.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("data_source_id", "row_number"),
        sa.UniqueConstraint(
            "data_source_id", "participant_id", name="uq_data_source_row_participant"
        ),
    )
    with op.batch_alter_table("participant") as batch_op:
        batch_op.add_column(
            sa.Column("managed_by_data_source_id", sa.Uuid(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_participant_managed_by_data_source",
            "data_source",
            ["managed_by_data_source_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("participant") as batch_op:
        batch_op.drop_constraint(
            "fk_participant_managed_by_data_source", type_="foreignkey"
        )
        batch_op.drop_column("managed_by_data_source_id")
    op.drop_table("data_source_row")
    op.drop_table("data_source")
