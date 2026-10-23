from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.models import Course, Profile, Task


def headers(tokens, user):
    return {"Authorization": "Bearer " + tokens(user)}


def create(client, path, auth, body):
    response = client.post("/api/v1/" + path, headers=auth, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_profile_identity_and_validation(client, tokens):
    user = uuid4()
    auth = headers(tokens, user)
    response = client.get("/api/v1/me", headers=auth)
    assert response.status_code == 200
    assert response.json()["id"] == str(user)
    assert response.json()["timezone"] == "UTC"
    patch = client.patch(
        "/api/v1/me",
        headers=auth,
        json={
            "display_name": "Student",
            "timezone": "Asia/Shanghai",
        },
    )
    assert patch.status_code == 200
    assert patch.json()["display_name"] == "Student"
    for body in [{"user_id": str(uuid4())}, {"timezone": "Unknown/City"}, {"timezone": None}]:
        assert client.patch("/api/v1/me", headers=auth, json=body).status_code == 422


def test_course_crud_and_isolation(client, tokens):
    owner, other = headers(tokens, uuid4()), headers(tokens, uuid4())
    item = create(
        client, "courses", owner, {"name": "Calculus", "code": "MATH", "color": "#123456"}
    )
    path = "/api/v1/courses/" + item["id"]
    assert client.get(path, headers=owner).json()["name"] == "Calculus"
    assert client.get("/api/v1/courses", headers=other).json()["total"] == 0
    for method in ["get", "patch", "delete"]:
        kwargs = {"json": {"name": "Stolen"}} if method == "patch" else {}
        assert getattr(client, method)(path, headers=other, **kwargs).status_code == 404
    assert client.patch(path, headers=owner, json={"name": "Updated"}).json()["name"] == "Updated"
    assert client.delete(path, headers=owner).status_code == 204
    assert client.get(path, headers=owner).status_code == 404


def test_task_crud_and_completion(client, tokens):
    owner = headers(tokens, uuid4())
    task = create(
        client,
        "tasks",
        owner,
        {
            "title": "Homework",
            "description": "Read chapter 2",
            "status": "done",
            "priority": "high",
            "due_at": "2026-10-23T12:00:00+08:00",
        },
    )
    assert task["completed_at"] is not None
    assert datetime.fromisoformat(task["due_at"]).astimezone(timezone.utc).hour == 4
    path = "/api/v1/tasks/" + task["id"]
    assert client.get(path, headers=owner).json()["title"] == "Homework"
    reopened = client.patch(
        path,
        headers=owner,
        json={
            "status": "in_progress",
            "due_at": None,
            "description": None,
        },
    )
    assert reopened.status_code == 200
    assert reopened.json()["completed_at"] is None
    assert reopened.json()["due_at"] is None
    assert reopened.json()["description"] is None
    done = client.patch(path, headers=owner, json={"status": "done"}).json()
    assert done["completed_at"] is not None
    assert (
        client.patch(path, headers=owner, json={"priority": "low"}).json()["completed_at"]
        == done["completed_at"]
    )
    assert client.delete(path, headers=owner).status_code == 204
    assert client.get(path, headers=owner).status_code == 404


def test_task_ownership_and_course_link(client, tokens):
    first, second = headers(tokens, uuid4()), headers(tokens, uuid4())
    course = create(client, "courses", first, {"name": "Private"})
    second_task = create(client, "tasks", second, {"title": "Second user"})
    assert (
        client.post(
            "/api/v1/tasks",
            headers=second,
            json={
                "title": "Bad link",
                "course_id": course["id"],
            },
        ).status_code
        == 404
    )
    assert (
        client.patch(
            "/api/v1/tasks/" + second_task["id"],
            headers=second,
            json={
                "course_id": course["id"],
            },
        ).status_code
        == 404
    )
    task = create(client, "tasks", first, {"title": "Private", "course_id": course["id"]})
    path = "/api/v1/tasks/" + task["id"]
    for method in ["get", "patch", "delete"]:
        kwargs = {"json": {"title": "Stolen"}} if method == "patch" else {}
        assert getattr(client, method)(path, headers=second, **kwargs).status_code == 404
    listing = client.get("/api/v1/tasks", headers=second).json()
    assert [item["id"] for item in listing["items"]] == [second_task["id"]]
    assert (
        client.get("/api/v1/tasks", headers=second, params={"course_id": course["id"]}).json()[
            "total"
        ]
        == 0
    )
    assert client.delete("/api/v1/courses/" + course["id"], headers=first).status_code == 204
    assert client.get(path, headers=first).json()["course_id"] is None


def test_task_filters_and_pagination(client, tokens):
    auth = headers(tokens, uuid4())
    course = create(client, "courses", auth, {"name": "Course"})
    expected = create(
        client,
        "tasks",
        auth,
        {
            "title": "Matching",
            "course_id": course["id"],
            "priority": "high",
            "status": "in_progress",
            "due_at": "2026-10-23T12:00:00Z",
        },
    )
    create(client, "tasks", auth, {"title": "No deadline"})
    create(client, "tasks", auth, {"title": "Earlier", "due_at": "2026-10-01T00:00:00Z"})
    query = {
        "status": "in_progress",
        "priority": "high",
        "course_id": course["id"],
        "due_after": "2026-10-23T12:00:00Z",
        "due_before": "2026-10-23T12:00:00Z",
    }
    result = client.get("/api/v1/tasks", headers=auth, params=query).json()
    assert result["total"] == 1
    assert result["items"][0]["id"] == expected["id"]
    for key in ["status", "priority", "course_id", "due_before", "due_after"]:
        assert expected["id"] in [
            item["id"]
            for item in client.get(
                "/api/v1/tasks",
                headers=auth,
                params={key: query[key]},
            ).json()["items"]
        ]
    first = client.get("/api/v1/tasks", headers=auth, params={"limit": 2}).json()
    second = client.get("/api/v1/tasks", headers=auth, params={"limit": 2, "offset": 2}).json()
    assert first["total"] == second["total"] == 3
    assert len(first["items"]) == 2 and len(second["items"]) == 1
    assert not {i["id"] for i in first["items"]} & {i["id"] for i in second["items"]}
    assert client.get("/api/v1/tasks", headers=auth, params={"offset": 10}).json()["items"] == []
    for params in [
        {"limit": 101},
        {"offset": -1},
        {"status": "invalid"},
        {"due_after": "2027-01-01T00:00:00Z", "due_before": "2026-01-01T00:00:00Z"},
    ]:
        assert client.get("/api/v1/tasks", headers=auth, params=params).status_code == 422


@pytest.mark.parametrize(
    "path,body",
    [
        ("courses", {"name": " "}),
        ("courses", {"name": "X", "user_id": str(uuid4())}),
        ("courses", {"name": "X", "color": "red"}),
        ("tasks", {"title": ""}),
        ("tasks", {"title": "X", "user_id": str(uuid4())}),
        ("tasks", {"title": "X", "status": "invalid"}),
        ("tasks", {"title": "X", "due_at": "2026-10-23T12:00:00"}),
        ("tasks", {"title": "X", "completed_at": "2026-01-01T00:00:00Z"}),
    ],
)
def test_invalid_create(client, tokens, path, body):
    assert (
        client.post("/api/v1/" + path, headers=headers(tokens, uuid4()), json=body).status_code
        == 422
    )


def test_null_patch_and_course_pagination(client, tokens):
    auth = headers(tokens, uuid4())
    course = create(client, "courses", auth, {"name": "X"})
    task = create(client, "tasks", auth, {"title": "Y", "course_id": course["id"]})
    for body in [{"title": None}, {"status": None}, {"priority": None}, {"user_id": str(uuid4())}]:
        assert (
            client.patch("/api/v1/tasks/" + task["id"], headers=auth, json=body).status_code == 422
        )
    for body in [{"name": None}, {"color": None}]:
        assert (
            client.patch("/api/v1/courses/" + course["id"], headers=auth, json=body).status_code
            == 422
        )
    assert (
        client.patch("/api/v1/tasks/" + task["id"], headers=auth, json={"course_id": None}).json()[
            "course_id"
        ]
        is None
    )
    create(client, "courses", auth, {"name": "Z"})
    page = client.get("/api/v1/courses", headers=auth, params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 2 and len(page["items"]) == 1


def test_unauthenticated_api(client, tokens):
    for path in ["/me", "/courses", "/tasks"]:
        response = client.get("/api/v1" + path)
        assert response.status_code == 401
        assert response.headers["www-authenticate"] == "Bearer"
    invalid = client.get("/api/v1/tasks", headers={"Authorization": "Bearer malformed"})
    assert invalid.status_code == 401


def test_database_enforces_course_owner(db):
    first, second = uuid4(), uuid4()
    db.add_all([Profile(id=first), Profile(id=second)])
    db.flush()
    course = Course(user_id=first, name="First only")
    db.add(course)
    db.flush()
    db.add(Task(user_id=second, course_id=course.id, title="Forbidden"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_database_status_constraint(db):
    user = uuid4()
    db.add(Profile(id=user))
    db.flush()
    db.add(Task(user_id=user, title="Invalid", status="unknown"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_database_uuid_and_updated_timestamp(client, db, tokens):
    user = uuid4()
    auth = headers(tokens, user)
    item = create(client, "tasks", auth, {"title": "Timestamp"})
    task = db.scalar(select(Task).where(Task.id == UUID(item["id"])))
    assert isinstance(task.id, UUID)
    assert task.created_at.tzinfo is not None
    assert (
        client.patch(
            "/api/v1/tasks/" + item["id"], headers=auth, json={"title": "Updated"}
        ).status_code
        == 200
    )


@pytest.mark.parametrize("category", ["homeworks", "exams", "finals", "projects", "presentations"])
def test_category_persistence_filter_and_ownership(client, tokens, category):
    first, second = headers(tokens, uuid4()), headers(tokens, uuid4())
    item = create(client, "tasks", first, {"title": "Categorized", "category": category})
    assert item["category"] == category
    create(client, "tasks", second, {"title": "Other user", "category": category})
    listing = client.get("/api/v1/tasks", headers=first, params={"category": category}).json()
    assert listing["total"] == 1 and listing["items"][0]["id"] == item["id"]
    updated = client.patch(
        "/api/v1/tasks/" + item["id"],
        headers=first,
        json={"category": "projects" if category != "projects" else "exams"},
    )
    assert updated.status_code == 200
    assert (
        client.get("/api/v1/tasks/" + item["id"], headers=first).json()["category"]
        == updated.json()["category"]
    )
    assert (
        client.patch(
            "/api/v1/tasks/" + item["id"], headers=second, json={"category": "finals"}
        ).status_code
        == 404
    )


def test_category_default_and_validation(client, tokens):
    auth = headers(tokens, uuid4())
    item = create(client, "tasks", auth, {"title": "Default"})
    assert item["category"] == "homeworks"
    for value in ["unknown", None]:
        assert (
            client.post(
                "/api/v1/tasks", headers=auth, json={"title": "Invalid", "category": value}
            ).status_code
            == 422
        )
        assert (
            client.patch(
                "/api/v1/tasks/" + item["id"], headers=auth, json={"category": value}
            ).status_code
            == 422
        )
    assert (
        client.get("/api/v1/tasks", headers=auth, params={"category": "unknown"}).status_code == 422
    )


def test_database_category_constraint(db):
    user = uuid4()
    db.add(Profile(id=user))
    db.flush()
    db.add(Task(user_id=user, title="Invalid", category="unknown"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()
