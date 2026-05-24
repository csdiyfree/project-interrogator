from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db


router = APIRouter(prefix="/api", tags=["guides"])


def _require_session(x_session_id: str | None = Header(None, alias="X-Session-Id")) -> str:
    from app.main import require_session

    return require_session(x_session_id)


@router.get(
    "/interrogations/{interrogation_id}/guide",
    response_model=schemas.GuideDetail,
)
def get_guide(
    interrogation_id: str,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.GuideDetail:
    guide = (
        db.query(models.Guide)
        .join(models.Guide.interrogation)
        .join(models.Interrogation.project)
        .join(models.Project.resume)
        .filter(
            models.Guide.interrogation_id == interrogation_id,
            models.Interrogation.status == "ended",
            models.Interrogation.ended.is_(True),
            models.Resume.session_id == session_id,
        )
        .one_or_none()
    )
    if guide is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "guide_not_found", "message": "改进指南不存在"},
        )

    todos: list[schemas.TodoOut] = []
    if guide.status == "ready":
        todo_rows = (
            db.query(models.Todo)
            .filter(models.Todo.guide_id == guide.id)
            .order_by(models.Todo.order_index.asc())
            .all()
        )
        todos = [schemas.TodoOut.model_validate(todo) for todo in todo_rows]

    return schemas.GuideDetail(
        id=guide.id,
        interrogation_id=guide.interrogation_id,
        status=guide.status,
        traffic_light=guide.traffic_light if guide.status == "ready" else None,
        overview=guide.overview if guide.status == "ready" else None,
        todos=todos,
        error=guide.error,
    )


@router.patch("/todos/{todo_id}", response_model=schemas.TodoOut)
def update_todo(
    todo_id: str,
    body: schemas.TodoUpdate,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.TodoOut:
    todo = (
        db.query(models.Todo)
        .join(models.Todo.guide)
        .join(models.Guide.interrogation)
        .join(models.Interrogation.project)
        .join(models.Project.resume)
        .filter(
            models.Todo.id == todo_id,
            models.Resume.session_id == session_id,
        )
        .one_or_none()
    )
    if todo is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "todo_not_found", "message": "待办不存在"},
        )

    todo.done = body.done
    db.commit()
    db.refresh(todo)
    return schemas.TodoOut.model_validate(todo)
