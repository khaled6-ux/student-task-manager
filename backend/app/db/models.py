from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Profile(Timestamps, Base):
    __tablename__ = "profiles"
    # Supabase auth.users UUID, verified from the JWT; never supplied in a request body.
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", server_default="UTC")


class Course(Timestamps, Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_courses_id_user"),
        CheckConstraint("length(trim(name)) > 0", name="ck_courses_name"),
        Index("ix_courses_user_created", "user_id", "created_at"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str | None] = mapped_column(String(30))
    color: Mapped[str] = mapped_column(String(7), default="#226b55", server_default="#226b55")


class Task(Timestamps, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["course_id", "user_id"],
            ["courses.id", "courses.user_id"],
            name="fk_tasks_course_owner",
        ),
        CheckConstraint("length(trim(title)) > 0", name="ck_tasks_title"),
        CheckConstraint("status IN ('todo', 'in_progress', 'done')", name="ck_tasks_status"),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="ck_tasks_priority"),
        CheckConstraint(
            "(status = 'done' AND completed_at IS NOT NULL) OR "
            "(status <> 'done' AND completed_at IS NULL)",
            name="ck_tasks_completed",
        ),
        Index("ix_tasks_user_status_due", "user_id", "status", "due_at"),
        Index("ix_tasks_user_course", "user_id", "course_id"),
        Index("ix_tasks_user_priority_due", "user_id", "priority", "due_at"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"))
    course_id: Mapped[UUID | None] = mapped_column(Uuid)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="todo", server_default="todo")
    priority: Mapped[str] = mapped_column(String(10), default="medium", server_default="medium")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
