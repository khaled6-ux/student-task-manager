from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

Name = Annotated[str, Field(min_length=1, max_length=100)]
Title = Annotated[str, Field(min_length=1, max_length=200)]
Color = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
Status = Literal["todo", "in_progress", "done"]
Category = Literal["homeworks", "exams", "finals", "projects", "presentations"]
Priority = Literal["low", "medium", "high"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CourseCreate(Input):
    name: Name
    code: str | None = Field(default=None, max_length=30)
    color: Color = "#226b55"


class CoursePatch(Input):
    name: Name | None = None
    code: str | None = Field(default=None, max_length=30)
    color: Color | None = None

    @field_validator("name", "color")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class TaskCreate(Input):
    title: Title
    description: str | None = Field(default=None, max_length=10000)
    status: Status = "todo"
    category: Category = "homeworks"
    priority: Priority = "medium"
    due_at: AwareDatetime | None = None
    course_id: UUID | None = None


class TaskPatch(Input):
    title: Title | None = None
    description: str | None = Field(default=None, max_length=10000)
    status: Status | None = None
    category: Category | None = None
    priority: Priority | None = None
    due_at: AwareDatetime | None = None
    course_id: UUID | None = None

    @field_validator("title", "status", "priority", "category")
    @classmethod
    def not_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class ProfilePatch(Input):
    display_name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            if value is None:
                raise ValueError("Timezone cannot be null")
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Unknown IANA timezone") from exc
        return value


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class ProfileOut(Output):
    display_name: str | None
    timezone: str


class CourseOut(Output):
    user_id: UUID
    name: str
    code: str | None
    color: str


class TaskOut(Output):
    user_id: UUID
    course_id: UUID | None
    title: str
    description: str | None
    status: Status
    priority: Priority
    category: Category
    due_at: datetime | None
    completed_at: datetime | None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
