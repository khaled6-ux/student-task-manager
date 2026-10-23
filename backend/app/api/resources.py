from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import AwareDatetime
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import current_user
from app.db.models import Course, Profile, Task
from app.db.session import get_db
from app.schemas.resources import (
    CourseCreate,
    CourseOut,
    CoursePatch,
    Page,
    Priority,
    ProfileOut,
    ProfilePatch,
    Status,
    TaskCreate,
    TaskOut,
    TaskPatch,
)

router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(get_db)]
User = Annotated[UUID, Depends(current_user)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def save(db: Session):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting resource change") from exc


def profile(db: Session, user: UUID) -> Profile:
    # Concurrency-safe provisioning without copying identity/email from untrusted bodies.
    db.execute(insert(Profile).values(id=user).on_conflict_do_nothing(index_elements=[Profile.id]))
    return db.get(Profile, user)


def owned(db: Session, model, resource_id: UUID, user: UUID):
    item = db.scalar(select(model).where(model.id == resource_id, model.user_id == user))
    if item is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    return item


def page(db: Session, statement, limit: int, offset: int):
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    items = db.scalars(
        statement.order_by(
            statement.column_descriptions[0]["entity"].created_at.desc(),
            statement.column_descriptions[0]["entity"].id,
        )
        .limit(limit)
        .offset(offset)
    ).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/me", response_model=ProfileOut, tags=["profile"])
def get_profile(user: User, db: DB):
    item = profile(db, user)
    save(db)
    return item


@router.patch("/me", response_model=ProfileOut, tags=["profile"])
def patch_profile(body: ProfilePatch, user: User, db: DB):
    item = profile(db, user)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    save(db)
    return item


@router.get("/courses", response_model=Page[CourseOut], tags=["courses"])
def list_courses(user: User, db: DB, limit: Limit = 20, offset: Offset = 0):
    return page(db, select(Course).where(Course.user_id == user), limit, offset)


@router.post("/courses", response_model=CourseOut, status_code=201, tags=["courses"])
def create_course(body: CourseCreate, user: User, db: DB):
    profile(db, user)
    item = Course(user_id=user, **body.model_dump())
    db.add(item)
    save(db)
    return item


@router.get("/courses/{course_id}", response_model=CourseOut, tags=["courses"])
def get_course(course_id: UUID, user: User, db: DB):
    return owned(db, Course, course_id, user)


@router.patch("/courses/{course_id}", response_model=CourseOut, tags=["courses"])
def patch_course(course_id: UUID, body: CoursePatch, user: User, db: DB):
    item = owned(db, Course, course_id, user)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    save(db)
    return item


@router.delete("/courses/{course_id}", status_code=204, tags=["courses"])
def delete_course(course_id: UUID, user: User, db: DB):
    item = owned(db, Course, course_id, user)
    # Retain tasks when deleting a course. The composite FK remains the final race-safe guard.
    db.execute(
        update(Task)
        .where(
            Task.course_id == course_id,
            Task.user_id == user,
        )
        .values(course_id=None)
    )
    db.delete(item)
    save(db)
    return Response(status_code=204)


@router.get("/tasks", response_model=Page[TaskOut], tags=["tasks"])
def list_tasks(
    user: User,
    db: DB,
    limit: Limit = 20,
    offset: Offset = 0,
    status: Status | None = None,
    priority: Priority | None = None,
    course_id: UUID | None = None,
    due_after: AwareDatetime | None = None,
    due_before: AwareDatetime | None = None,
):
    if due_after and due_before and due_after > due_before:
        raise HTTPException(status_code=422, detail="due_after must not exceed due_before")
    statement = select(Task).where(Task.user_id == user)
    for field, value in [
        (Task.status, status),
        (Task.priority, priority),
        (Task.course_id, course_id),
    ]:
        if value is not None:
            statement = statement.where(field == value)
    if due_after:
        statement = statement.where(Task.due_at >= due_after)
    if due_before:
        statement = statement.where(Task.due_at <= due_before)
    return page(db, statement, limit, offset)


@router.post("/tasks", response_model=TaskOut, status_code=201, tags=["tasks"])
def create_task(body: TaskCreate, user: User, db: DB):
    if body.course_id is not None:
        owned(db, Course, body.course_id, user)
    profile(db, user)
    item = Task(user_id=user, **body.model_dump())
    if item.status == "done":
        item.completed_at = datetime.now(timezone.utc)
    db.add(item)
    save(db)
    return item


@router.get("/tasks/{task_id}", response_model=TaskOut, tags=["tasks"])
def get_task(task_id: UUID, user: User, db: DB):
    return owned(db, Task, task_id, user)


@router.patch("/tasks/{task_id}", response_model=TaskOut, tags=["tasks"])
def patch_task(task_id: UUID, body: TaskPatch, user: User, db: DB):
    item = owned(db, Task, task_id, user)
    changes = body.model_dump(exclude_unset=True)
    if changes.get("course_id") is not None:
        owned(db, Course, changes["course_id"], user)
    if "status" in changes and changes["status"] != item.status:
        item.completed_at = datetime.now(timezone.utc) if changes["status"] == "done" else None
    for key, value in changes.items():
        setattr(item, key, value)
    save(db)
    return item


@router.delete("/tasks/{task_id}", status_code=204, tags=["tasks"])
def delete_task(task_id: UUID, user: User, db: DB):
    db.delete(owned(db, Task, task_id, user))
    save(db)
    return Response(status_code=204)
