from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.llm import AVAILABLE_MODELS, DEFAULT_MODEL
from app.services.interrogation_service import (
    create_next_and_preprocess,
    stream_answer,
    validate_answerable,
)


router = APIRouter(prefix="/api", tags=["interrogations"])


def _require_session(
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> str:
    from app.main import require_session

    return require_session(x_session_id)


@router.get(
    "/interrogations/{interrogation_id}",
    response_model=schemas.InterrogationDetail,
)
def get_interrogation(
    interrogation_id: str,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.InterrogationDetail:
    interrogation = _get_interrogation(db, interrogation_id, session_id)
    manuscript = list(
        db.scalars(
            select(models.ManuscriptEntry)
            .where(models.ManuscriptEntry.interrogation_id == interrogation.id)
            .order_by(models.ManuscriptEntry.index)
        )
    )
    turns = list(
        db.scalars(
            select(models.Turn)
            .where(models.Turn.interrogation_id == interrogation.id)
            .order_by(models.Turn.index)
        )
    )
    return schemas.InterrogationDetail(
        id=interrogation.id,
        project_id=interrogation.project_id,
        round_number=interrogation.round_number,
        status=interrogation.status,
        ended=interrogation.ended,
        prev_round_number=(
            interrogation.round_number - 1 if interrogation.round_number > 1 else None
        ),
        model=interrogation.model,
        manuscript=[
            schemas.ManuscriptEntryOut.model_validate(item) for item in manuscript
        ],
        turns=[schemas.TurnOut.model_validate(item) for item in turns],
        closing_message=interrogation.closing_message,
        error=interrogation.error,
    )


@router.post("/interrogations/{interrogation_id}/answer")
def answer_interrogation(
    interrogation_id: str,
    body: schemas.AnswerRequest,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    _get_interrogation(db, interrogation_id, session_id)
    validate_answerable(interrogation_id, body.turn_index)
    return StreamingResponse(
        stream_answer(interrogation_id, body.turn_index, body.answer),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.get("/projects/{project_id}", response_model=schemas.ProjectDetail)
def get_project(
    project_id: str,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.ProjectDetail:
    project = _get_project(db, project_id, session_id)
    interrogations = list(
        db.scalars(
            select(models.Interrogation)
            .where(models.Interrogation.project_id == project.id)
            .order_by(models.Interrogation.round_number.desc())
        )
    )
    if not interrogations:
        raise HTTPException(
            status_code=404,
            detail={"code": "interrogation_not_found", "message": "项目尚无拷问记录"},
        )

    interrogation_ids = [item.id for item in interrogations]
    guide_ids = set(
        db.scalars(
            select(models.Guide.interrogation_id).where(
                models.Guide.interrogation_id.in_(interrogation_ids)
            )
        )
    )
    return schemas.ProjectDetail(
        id=project.id,
        resume_id=project.resume_id,
        name=project.name,
        raw_description=project.raw_description,
        order_index=project.order_index,
        current_interrogation_id=interrogations[0].id,
        interrogations=[
            schemas.InterrogationBrief(
                id=item.id,
                round_number=item.round_number,
                status=item.status,
                ended=item.ended,
                has_guide=item.id in guide_ids,
                created_at=item.created_at,
            )
            for item in interrogations
        ],
    )


@router.post(
    "/projects/{project_id}/reinterrogate",
    response_model=schemas.ReinterrogateResponse,
    status_code=202,
)
async def reinterrogate_project(
    project_id: str,
    body: schemas.ReinterrogateRequest,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.ReinterrogateResponse:
    project = _get_project(db, project_id, session_id)
    prev_summary = db.scalar(
        select(models.Guide.summary_for_next)
        .join(models.Guide.interrogation)
        .where(
            models.Interrogation.project_id == project.id,
            models.Guide.status == "ready",
        )
        .order_by(models.Interrogation.round_number.desc())
        .limit(1)
    )
    interrogation_id = await create_next_and_preprocess(
        project_id=project.id,
        prev_summary=prev_summary,
        model=body.model or DEFAULT_MODEL,
    )
    return schemas.ReinterrogateResponse(interrogation_id=interrogation_id)


@router.get("/models", response_model=schemas.ModelsResponse)
def get_models(_session_id: str = Depends(_require_session)) -> schemas.ModelsResponse:
    return schemas.ModelsResponse(models=AVAILABLE_MODELS, default=DEFAULT_MODEL)


def _get_interrogation(
    db: Session,
    interrogation_id: str,
    session_id: str,
) -> models.Interrogation:
    interrogation = db.scalar(
        select(models.Interrogation)
        .join(models.Interrogation.project)
        .join(models.Project.resume)
        .where(
            models.Interrogation.id == interrogation_id,
            models.Resume.session_id == session_id,
        )
    )
    if interrogation is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "interrogation_not_found", "message": "拷问不存在"},
        )
    return interrogation


def _get_project(db: Session, project_id: str, session_id: str) -> models.Project:
    project = db.scalar(
        select(models.Project)
        .join(models.Project.resume)
        .where(models.Project.id == project_id, models.Resume.session_id == session_id)
    )
    if project is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "project_not_found", "message": "项目不存在"},
        )
    return project
