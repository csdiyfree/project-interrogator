from typing import Any

from app import models
from app.db import SessionLocal
from app.llm import complete_json
from app.prompts.registry import render


VALID_TRAFFIC_LIGHTS = {"red", "yellow", "green"}
VALID_TODO_CATEGORIES = {"resume_fix", "knowledge_prep", "other"}


async def generate_for(interrogation_id: str) -> None:
    db = SessionLocal()
    guide: models.Guide | None = None
    try:
        interrogation = (
            db.query(models.Interrogation)
            .filter(models.Interrogation.id == interrogation_id)
            .one_or_none()
        )
        if interrogation is None:
            raise ValueError("interrogation not found")
        if interrogation.status != "ended" or not interrogation.ended:
            return

        guide = (
            db.query(models.Guide)
            .filter(models.Guide.interrogation_id == interrogation_id)
            .one_or_none()
        )
        if guide is None:
            guide = models.Guide(interrogation_id=interrogation_id, status="generating")
            db.add(guide)

        guide.status = "generating"
        guide.traffic_light = None
        guide.overview = None
        guide.summary_for_next = None
        guide.error = None
        db.commit()

        project = interrogation.project
        resume = project.resume
        manuscript_entries = (
            db.query(models.ManuscriptEntry)
            .filter(models.ManuscriptEntry.interrogation_id == interrogation_id)
            .order_by(models.ManuscriptEntry.index.asc())
            .all()
        )
        turns = (
            db.query(models.Turn)
            .filter(
                models.Turn.interrogation_id == interrogation_id,
                models.Turn.answer.is_not(None),
            )
            .order_by(models.Turn.index.asc())
            .all()
        )

        prompt = render(
            "guide",
            resume_summary=_format_resume_summary(resume.summary_json),
            project_name=project.name,
            project_description=project.raw_description,
            manuscript_history=_format_manuscript_history(manuscript_entries),
            qa_history=_format_qa_history(turns),
            prev_summary_block=_format_prev_summary_block(interrogation.prev_summary),
        )
        data = await complete_json(
            [{"role": "user", "content": prompt}],
            model=interrogation.model,
        )

        traffic_light = _validate_traffic_light(data.get("traffic_light"))
        overview = _required_text(data.get("overview"), "overview")
        summary_for_next = _required_text(data.get("summary_for_next"), "summary_for_next")
        todos_data = _validate_todos(data.get("todos"))

        for todo in (
            db.query(models.Todo)
            .filter(models.Todo.guide_id == guide.id)
            .order_by(models.Todo.order_index.asc())
            .all()
        ):
            db.delete(todo)

        guide.traffic_light = traffic_light
        guide.overview = overview
        guide.summary_for_next = summary_for_next
        guide.status = "ready"
        guide.error = None

        for order_index, todo in enumerate(todos_data):
            db.add(
                models.Todo(
                    guide_id=guide.id,
                    category=todo["category"],
                    content=todo["content"],
                    done=False,
                    order_index=order_index,
                )
            )

        db.commit()
    except Exception as exc:
        db.rollback()
        if guide is not None:
            guide = (
                db.query(models.Guide)
                .filter(models.Guide.interrogation_id == guide.interrogation_id)
                .one_or_none()
            )
            if guide is None:
                guide = models.Guide(interrogation_id=interrogation_id, status="failed")
                db.add(guide)
            guide.status = "failed"
            guide.traffic_light = None
            guide.overview = None
            guide.summary_for_next = None
            guide.error = str(exc)
            db.commit()
    finally:
        db.close()


def _format_resume_summary(summary_json: Any) -> str:
    if not summary_json:
        return ""
    if not isinstance(summary_json, dict):
        return str(summary_json)

    lines: list[str] = []
    headline = summary_json.get("headline")
    if headline:
        lines.append(str(headline))

    items = summary_json.get("items") or []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                label = str(item.get("label") or "").strip()
                value = str(item.get("value") or "").strip()
                if label and value:
                    lines.append(f"- {label}: {value}")
                elif value:
                    lines.append(f"- {value}")
            elif item:
                lines.append(f"- {item}")

    return "\n".join(lines)


def _format_manuscript_history(entries: list[models.ManuscriptEntry]) -> str:
    lines: list[str] = []
    for entry in entries:
        label = "【初印象】" if entry.index == 0 else f"【第{entry.index}轮】"
        lines.append(f"{label}{entry.content}")
    return "\n".join(lines)


def _format_qa_history(turns: list[models.Turn]) -> str:
    lines: list[str] = []
    for turn in turns:
        number = turn.index + 1
        lines.append(f"Q{number}: {turn.question}")
        lines.append(f"A{number}: {turn.answer}")
    return "\n".join(lines)


def _format_prev_summary_block(prev_summary: str | None) -> str:
    if not prev_summary:
        return ""
    return f"# 上一轮拷打回顾\n{prev_summary}"


def _validate_traffic_light(value: Any) -> str:
    traffic_light = str(value).strip()
    if traffic_light not in VALID_TRAFFIC_LIGHTS:
        raise ValueError("invalid traffic_light")
    return traffic_light


def _required_text(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"invalid {field_name}")
    return value.strip()


def _validate_todos(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise ValueError("invalid todos")

    todos: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("invalid todo")
        category = str(item.get("category")).strip()
        if category not in VALID_TODO_CATEGORIES:
            raise ValueError("invalid todo category")
        content = _required_text(item.get("content"), "todo content")
        todos.append(
            {
                "category": category,
                "content": content,
            }
        )
    return todos
