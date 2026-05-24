import asyncio
import re
from datetime import datetime
from typing import Any

from app import models, schemas
from app.db import SessionLocal
from app.llm import complete_json
from app.prompts.registry import render


PROJECT_BOUNDARY_KEYS = {"name", "start_line", "end_line"}


async def parse_resume(resume_id: str) -> None:
    db = SessionLocal()
    try:
        resume = db.get(models.Resume, resume_id)
        if resume is None:
            return

        raw_text = resume.raw_text
        resume_lines = _resume_lines(raw_text)
        numbered_resume_text = _numbered_resume_text(resume_lines)
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
                        "content": render(
                            "resume_projects",
                            resume_text=numbered_resume_text,
                        ),
                    }
                ]
            ),
        )

        resume.summary_json = schemas.ResumeSummary.model_validate(
            summary_result
        ).model_dump()

        projects_payload = _projects_from_boundaries(projects_result, resume_lines)

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
            base_name = _parsed_name_base(resume.summary_json, resume.created_at)
            resume.name = _unique_name(db, resume.session_id, base_name)
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


def _resume_lines(raw_text: str) -> list[str]:
    lines = raw_text.splitlines()
    if lines:
        return lines
    return [raw_text]


def _numbered_resume_text(lines: list[str]) -> str:
    return "\n".join(f"{index}: {line}" for index, line in enumerate(lines, start=1))


def _projects_from_boundaries(
    projects_result: dict,
    resume_lines: list[str],
) -> list[dict[str, str]]:
    if (
        not isinstance(projects_result, dict)
        or set(projects_result.keys()) != {"projects"}
    ):
        raise ValueError("项目抽取结果不符合契约")

    projects_payload = projects_result["projects"]
    if not isinstance(projects_payload, list):
        raise ValueError("项目抽取结果不符合契约")

    projects: list[dict[str, str]] = []
    for index, project_data in enumerate(projects_payload):
        start_line = _line_number(project_data, "start_line", index)
        end_line = _line_number(project_data, "end_line", index)
        name = _project_name(project_data, index)

        if start_line > end_line:
            raise ValueError(f"第{index + 1}个项目行号范围无效")
        if end_line > len(resume_lines):
            raise ValueError(f"第{index + 1}个项目行号超出简历范围")

        raw_description = "\n".join(resume_lines[start_line - 1 : end_line]).strip()
        if not raw_description:
            raise ValueError(f"第{index + 1}个项目原文片段为空")

        projects.append({"name": name, "raw_description": raw_description})

    return projects


def _line_number(project_data: Any, key: str, index: int) -> int:
    if (
        not isinstance(project_data, dict)
        or set(project_data.keys()) != PROJECT_BOUNDARY_KEYS
    ):
        raise ValueError(f"第{index + 1}个项目边界不符合契约")

    value = project_data[key]
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"第{index + 1}个项目 {key} 必须是正整数")
    return value


def _project_name(project_data: Any, index: int) -> str:
    if (
        not isinstance(project_data, dict)
        or set(project_data.keys()) != PROJECT_BOUNDARY_KEYS
    ):
        raise ValueError(f"第{index + 1}个项目边界不符合契约")

    value = project_data["name"]
    if not isinstance(value, str):
        raise ValueError(f"第{index + 1}个项目名称必须是非空字符串")

    name = _project_name_from_line(value)
    if not name:
        raise ValueError(f"第{index + 1}个项目名称必须是非空字符串")
    return name


def _project_name_from_line(line: str) -> str:
    name = line.strip()
    name = re.sub(r"^\s{0,3}#{1,6}\s*", "", name)
    name = re.sub(r"^\s*(?:[-*+•●○]|\\\(\s*\\bullet\s*\\\))\s*", "", name)
    name = re.sub(
        r"^\s*(?:[（(]?\d{1,2}[)）、]\s*|\d{1,2}\.\s+|[一二三四五六七八九十]+[、.)）]\s*)",
        "",
        name,
    )
    date = r"\d{4}(?:[./]\d{1,2}|年\d{1,2}月?)"
    name = re.sub(rf"^\s*{date}\s*[-–—~]\s*(?:{date}|至今|现在|今)\s+", "", name)
    return name.strip(" ：:")


def temporary_name(created_at: datetime) -> str:
    return f"简历 {_format_upload_minute(created_at)}"


def _parsed_name_base(summary_json: dict | None, created_at: datetime) -> str:
    upload_day = _format_upload_day(created_at)
    seed = _summary_name(summary_json)
    if not seed:
        return upload_day
    return f"{seed} {upload_day}"


def _summary_name(summary_json: dict | None) -> str:
    if not isinstance(summary_json, dict):
        return ""

    items = summary_json.get("items")
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            label = item.get("label")
            value = item.get("value")
            if isinstance(label, str) and "姓名" in label and isinstance(value, str):
                name = value.strip()
                if name:
                    return name

    headline = summary_json.get("headline")
    if isinstance(headline, str):
        return headline.strip()
    return ""


def _unique_name(db, session_id: str, base: str) -> str:
    existing_names = {
        row[0]
        for row in db.query(models.Resume.name)
        .filter(models.Resume.session_id == session_id)
        .all()
        if row[0]
    }
    if base not in existing_names:
        return base

    index = 1
    while f"{base} ({index})" in existing_names:
        index += 1
    return f"{base} ({index})"


def _format_upload_day(created_at: datetime) -> str:
    return f"{created_at.month}月{created_at.day}日"


def _format_upload_minute(created_at: datetime) -> str:
    return f"{created_at.month}月{created_at.day}日 {created_at:%H:%M}"
