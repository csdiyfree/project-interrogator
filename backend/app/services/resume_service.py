import asyncio

from app import models, schemas
from app.db import SessionLocal
from app.llm import complete_json
from app.prompts.registry import render


PROJECT_KEYS = {"name", "raw_description"}


async def parse_resume(resume_id: str) -> None:
    db = SessionLocal()
    try:
        resume = db.get(models.Resume, resume_id)
        if resume is None:
            return

        raw_text = resume.raw_text
        summary_result, projects_result = await asyncio.gather(
            complete_json(
                [
                    {
                        "role": "user",
                        "content": render("resume_summary", resume_text=raw_text),
                    }
                ]
            ),
            complete_json(
                [
                    {
                        "role": "user",
                        "content": render("resume_projects", resume_text=raw_text),
                    }
                ]
            ),
        )

        resume.summary_json = schemas.ResumeSummary.model_validate(
            summary_result
        ).model_dump()

        projects_payload = _validate_projects_result(projects_result)

        projects: list[models.Project] = []
        for index, project_data in enumerate(projects_payload):
            project = models.Project(
                resume_id=resume_id,
                name=project_data["name"],
                raw_description=project_data["raw_description"],
                order_index=index,
            )
            db.add(project)
            projects.append(project)

        resume.error = None
        db.flush()
        project_ids = [project.id for project in projects]
        db.commit()

        await asyncio.gather(
            *(_create_and_preprocess(project_id) for project_id in project_ids)
        )

        if project_ids:
            created_count = (
                db.query(models.Interrogation)
                .filter(models.Interrogation.project_id.in_(project_ids))
                .count()
            )
            if created_count != len(project_ids):
                raise ValueError("首轮拷问占位创建失败")

        resume = db.get(models.Resume, resume_id)
        if resume is not None:
            resume.status = "parsed"
            resume.error = None
            db.commit()
    except Exception as exc:
        db.rollback()
        failed_resume = db.get(models.Resume, resume_id)
        if failed_resume is not None:
            failed_resume.status = "failed"
            failed_resume.error = str(exc) or type(exc).__name__
            db.commit()
    finally:
        db.close()


async def _create_and_preprocess(project_id: str) -> None:
    from app.services import interrogation_service

    await interrogation_service.create_and_preprocess(
        project_id=project_id,
        round_number=1,
        prev_summary=None,
        model=None,
    )


def _validate_projects_result(projects_result: dict) -> list[dict[str, str]]:
    if set(projects_result.keys()) != {"projects"}:
        raise ValueError("项目抽取结果不符合契约")

    projects_payload = projects_result["projects"]
    if not isinstance(projects_payload, list):
        raise ValueError("项目抽取结果不符合契约")

    projects: list[dict[str, str]] = []
    for project_data in projects_payload:
        if (
            not isinstance(project_data, dict)
            or set(project_data.keys()) != PROJECT_KEYS
        ):
            raise ValueError("项目条目不符合契约")

        name = project_data["name"]
        raw_description = project_data["raw_description"]
        if not isinstance(name, str) or not name.strip():
            raise ValueError("项目名称必须是非空字符串")
        if not isinstance(raw_description, str) or not raw_description.strip():
            raise ValueError("项目原文描述必须是非空字符串")

        projects.append({"name": name, "raw_description": raw_description})

    return projects
