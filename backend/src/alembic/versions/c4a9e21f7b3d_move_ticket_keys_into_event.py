"""move the ticket key pair into the event table

Revision ID: c4a9e21f7b3d
Revises: b8e4f2a1c9d3
Create Date: 2026-10-18
"""

from pathlib import Path

from alembic import op
import pyseto
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4a9e21f7b3d"
down_revision = "b8e4f2a1c9d3"
branch_labels = None
depends_on = None

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_KEY_PATH = _DATA_DIR / "key.pem"
_PUB_PATH = _DATA_DIR / "pub.pem"


def _load_key_pair(num_events: int) -> tuple[str, str]:
    """The pair every existing event keeps, so tickets already issued stay valid."""
    try:
        private_pem = _KEY_PATH.read_text()
        public_pem = _PUB_PATH.read_text()
        private_key = pyseto.Key.new(
            version=2, purpose="public", key=private_pem.encode()
        )
        public_key = pyseto.Key.new(
            version=2, purpose="public", key=public_pem.encode()
        )
        # Each file only has to be a well-formed key to load on its own, so sign
        # and verify to prove they belong together before sealing them in.
        pyseto.decode(public_key, pyseto.encode(private_key, b"key pair check"))
    except Exception as e:
        raise RuntimeError(
            f"Refusing to start: {num_events} event(s) exist but the ticket key "
            f"pair in {_DATA_DIR} could not be loaded, or key.pem and pub.pem do "
            f"not match ({e}). Restore both files from the same backup next to "
            "the database and start again. Existing tickets cannot be verified "
            "without them."
        ) from e
    return private_pem, public_pem


def upgrade() -> None:
    connection = op.get_bind()
    num_events = connection.execute(sa.text("SELECT COUNT(*) FROM event")).scalar_one()
    # Loaded before any DDL: SQLite commits DDL outside the migration transaction,
    # so a refusal has to leave the table untouched for the next start to retry.
    key_pair = _load_key_pair(num_events) if num_events else None

    with op.batch_alter_table("event") as batch_op:
        batch_op.add_column(sa.Column("paseto_private_key", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("paseto_public_key", sa.Text(), nullable=True))

    if key_pair is not None:
        private_pem, public_pem = key_pair
        connection.execute(
            sa.text(
                "UPDATE event SET paseto_private_key = :private_key,"
                " paseto_public_key = :public_key"
            ),
            {"private_key": private_pem, "public_key": public_pem},
        )

    with op.batch_alter_table("event") as batch_op:
        batch_op.alter_column(
            "paseto_private_key", existing_type=sa.Text(), nullable=False
        )
        batch_op.alter_column(
            "paseto_public_key", existing_type=sa.Text(), nullable=False
        )


def downgrade() -> None:
    with op.batch_alter_table("event") as batch_op:
        batch_op.drop_column("paseto_private_key")
        batch_op.drop_column("paseto_public_key")
