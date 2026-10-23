"""Persist the five task categories; existing tasks become homeworks.

Revision ID: b731a2c4d901
Revises: 9c23764cdb81
"""

import sqlalchemy as sa
from alembic import op

revision = "b731a2c4d901"
down_revision = "9c23764cdb81"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks", sa.Column("category", sa.String(20), nullable=False, server_default="homeworks")
    )
    op.create_check_constraint(
        "ck_tasks_category",
        "tasks",
        "category IN ('homeworks', 'exams', 'finals', 'projects', 'presentations')",
    )
    op.create_index("ix_tasks_user_category_due", "tasks", ["user_id", "category", "due_at"])


def downgrade() -> None:
    op.drop_index("ix_tasks_user_category_due", table_name="tasks")
    op.drop_constraint("ck_tasks_category", "tasks", type_="check")
    op.drop_column("tasks", "category")
