"""create profiles courses and tasks

Revision ID: 9c23764cdb81
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "9c23764cdb81"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("timezone", sa.String(length=64), server_default="UTC", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "courses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=True),
        sa.Column("color", sa.String(length=7), server_default="#226b55", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_courses_name"),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "user_id", name="uq_courses_id_user"),
    )
    op.create_index("ix_courses_user_created", "courses", ["user_id", "created_at"], unique=False)
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("course_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="todo", nullable=False),
        sa.Column("priority", sa.String(length=10), server_default="medium", nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "(status = 'done' AND completed_at IS NOT NULL) OR "
            "(status <> 'done' AND completed_at IS NULL)",
            name="ck_tasks_completed",
        ),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority"),
        sa.CheckConstraint("status IN ('todo', 'in_progress', 'done')", name="ck_tasks_status"),
        sa.CheckConstraint("length(trim(title)) > 0", name="ck_tasks_title"),
        sa.ForeignKeyConstraint(
            ["course_id", "user_id"],
            ["courses.id", "courses.user_id"],
            name="fk_tasks_course_owner",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_user_course", "tasks", ["user_id", "course_id"], unique=False)
    op.create_index(
        "ix_tasks_user_priority_due", "tasks", ["user_id", "priority", "due_at"], unique=False
    )
    op.create_index(
        "ix_tasks_user_status_due", "tasks", ["user_id", "status", "due_at"], unique=False
    )
    # Deny direct Data API access unless policies are deliberately added later.
    # The backend connects as a trusted table owner (not the browser/anon role).
    for table in ("profiles", "courses", "tasks"):
        op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))


def downgrade() -> None:
    op.drop_index("ix_tasks_user_status_due", table_name="tasks")
    op.drop_index("ix_tasks_user_priority_due", table_name="tasks")
    op.drop_index("ix_tasks_user_course", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_courses_user_created", table_name="courses")
    op.drop_table("courses")
    op.drop_table("profiles")
