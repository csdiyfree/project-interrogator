import asyncio

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

from app import models, schemas
from app.db import get_db
from app.pdf import pdf_to_text
from app.services import resume_service


router = APIRouter(prefix="/api", tags=["resumes"])


def _require_session(
    x_session_id: str | None = Header(None, alias="X-Session-Id"),
) -> str:
    from app.main import require_session

    return require_session(x_session_id)


@router.post(
    "/resumes",
    response_model=schemas.CreateResumeResponse,
    status_code=202,
)
async def create_resume(
    request: Request,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.CreateResumeResponse:
    source, raw_text = await _read_resume_input(request)
    created_at = models.utcnow()
    resume = models.Resume(
        created_at=created_at,
        session_id=session_id,
        source=source,
        raw_text=raw_text,
        status="parsing",
        name=resume_service.temporary_name(created_at),
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    asyncio.create_task(resume_service.parse_resume(resume.id))
    return schemas.CreateResumeResponse(resume_id=resume.id)


@router.get("/resumes", response_model=schemas.ResumesList)
def list_resumes(
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.ResumesList:
    resumes = (
        db.query(models.Resume)
        .filter(models.Resume.session_id == session_id)
        .order_by(models.Resume.created_at.desc())
        .all()
    )
    return schemas.ResumesList(
        resumes=[schemas.ResumeListItem.model_validate(resume) for resume in resumes]
    )


@router.get("/resumes/{resume_id}", response_model=schemas.ResumeDetail)
def get_resume(
    resume_id: str,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.ResumeDetail:
    resume = (
        db.query(models.Resume)
        .filter(models.Resume.id == resume_id, models.Resume.session_id == session_id)
        .first()
    )
    if resume is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "简历不存在"},
        )

    if resume.status == "parsing":
        return schemas.ResumeDetail(
            id=resume.id,
            name=resume.name,
            status=resume.status,
            summary=None,
            projects=[],
            error=resume.error,
        )

    summary = None
    if resume.summary_json is not None:
        summary = schemas.ResumeSummary.model_validate(resume.summary_json)

    projects = []
    for project in (
        db.query(models.Project)
        .filter(models.Project.resume_id == resume.id)
        .order_by(models.Project.order_index.asc())
        .all()
    ):
        interrogation = (
            db.query(models.Interrogation)
            .filter(models.Interrogation.project_id == project.id)
            .order_by(
                models.Interrogation.round_number.desc(),
                models.Interrogation.created_at.desc(),
            )
            .first()
        )
        current_interrogation = None
        if interrogation is not None:
            current_interrogation = schemas.CurrentInterrogation(
                id=interrogation.id,
                status=interrogation.status,
            )
        projects.append(
            schemas.ProjectInResume(
                id=project.id,
                name=project.name,
                raw_description=project.raw_description,
                order_index=project.order_index,
                current_interrogation=current_interrogation,
            )
        )

    return schemas.ResumeDetail(
        id=resume.id,
        name=resume.name,
        status=resume.status,
        summary=summary,
        projects=projects,
        error=resume.error,
    )


@router.patch("/resumes/{resume_id}", response_model=schemas.ResumeListItem)
def rename_resume(
    resume_id: str,
    payload: schemas.ResumeRename,
    session_id: str = Depends(_require_session),
    db: Session = Depends(get_db),
) -> schemas.ResumeListItem:
    resume = (
        db.query(models.Resume)
        .filter(models.Resume.id == resume_id, models.Resume.session_id == session_id)
        .first()
    )
    if resume is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "简历不存在"},
        )

    name = payload.name.strip()
    if not name:
        raise HTTPException(
            status_code=400,
            detail={"code": "empty_input", "message": "简历名称不能为空"},
        )

    resume.name = name
    db.commit()
    db.refresh(resume)
    return schemas.ResumeListItem.model_validate(resume)


async def _read_resume_input(request: Request) -> tuple[str, str]:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type == "application/json":
        try:
            payload = schemas.CreateResumeText.model_validate(await request.json())
        except (ValidationError, ValueError):
            raise HTTPException(
                status_code=400,
                detail={"code": "bad_request", "message": "请求参数不符合契约"},
            )
        if not payload.text.strip():
            raise HTTPException(
                status_code=400,
                detail={"code": "empty_input", "message": "简历文本不能为空"},
            )
        return "text", payload.text

    if content_type == "multipart/form-data":
        form = await request.form()
        file = form.get("file")
        if not isinstance(file, UploadFile) or not file.filename:
            raise HTTPException(
                status_code=400,
                detail={"code": "empty_input", "message": "请上传 PDF 简历"},
            )

        filename = file.filename
        file_type = (file.content_type or "").lower()
        if not filename.lower().endswith(".pdf") and file_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail={"code": "bad_file", "message": "仅支持 PDF 文件"},
            )

        file_bytes = await file.read()
        await file.close()
        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail={"code": "empty_input", "message": "请上传 PDF 简历"},
            )
        if not _looks_like_pdf(file_bytes):
            raise HTTPException(
                status_code=400,
                detail={"code": "bad_file", "message": "仅支持 PDF 文件"},
            )
        return "pdf", await pdf_to_text(file_bytes, filename)

    raise HTTPException(
        status_code=400,
        detail={"code": "empty_input", "message": "请提交简历文本或 PDF 文件"},
    )


def _looks_like_pdf(file_bytes: bytes) -> bool:
    return file_bytes.lstrip().startswith(b"%PDF-")
