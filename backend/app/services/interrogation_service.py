import asyncio
import importlib.util
import json
import re
from collections.abc import AsyncIterator, Coroutine
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app import models
from app.db import SessionLocal
from app.llm import DEFAULT_MODEL, LLMError, chat, stream_chat
from app.prompts.registry import render


PREPROCESS_USER = (
    "现在开始。你还没有听到候选人的任何回答。请先写下你对这个项目的【初印象】手稿,"
    "并提出你的第一个问题。严格按规定的分段格式输出,【结束】填 false。"
)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def parse_segments(text: str) -> tuple[str, bool, str]:
    pattern = re.compile(
        r"^\s*\[手稿\]\s*\n(?P<manuscript>.*?)\n\[结束\]\s*\n"
        r"(?P<ended>true|false)\s*\n\[问题\]\s*\n(?P<question>.*?)\s*$",
        re.S,
    )
    match = pattern.match(text)
    if not match:
        raise LLMError("LLM 返回内容不符合拷问分段格式")
    return (
        match.group("manuscript").strip("\n"),
        match.group("ended") == "true",
        match.group("question").strip("\n"),
    )


async def create_and_preprocess(
    project_id: str,
    round_number: int,
    prev_summary: str | None,
    model: str | None,
) -> str:
    db = SessionLocal()
    try:
        interrogation = models.Interrogation(
            project_id=project_id,
            round_number=round_number,
            status="preprocessing",
            prev_summary=prev_summary,
            model=model or DEFAULT_MODEL,
            ended=False,
        )
        db.add(interrogation)
        db.commit()
        interrogation_id = interrogation.id
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "round_conflict", "message": "拷问轮次已存在"},
        ) from exc
    finally:
        db.close()

    asyncio.create_task(_run_preprocess(interrogation_id))
    return interrogation_id


async def create_next_and_preprocess(
    project_id: str,
    prev_summary: str | None,
    model: str | None,
) -> str:
    db = SessionLocal()
    try:
        max_round = db.scalar(
            select(func.max(models.Interrogation.round_number)).where(
                models.Interrogation.project_id == project_id
            )
        )
        interrogation = models.Interrogation(
            project_id=project_id,
            round_number=(max_round or 0) + 1,
            status="preprocessing",
            prev_summary=prev_summary,
            model=model or DEFAULT_MODEL,
            ended=False,
        )
        db.add(interrogation)
        db.commit()
        interrogation_id = interrogation.id
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "round_conflict", "message": "拷问轮次已存在"},
        ) from exc
    finally:
        db.close()

    asyncio.create_task(_run_preprocess(interrogation_id))
    return interrogation_id


async def _run_preprocess(interrogation_id: str) -> None:
    db = SessionLocal()
    try:
        interrogation = db.get(models.Interrogation, interrogation_id)
        if interrogation is None:
            return
        project = interrogation.project
        resume = project.resume

        system = _render_system(interrogation, project, resume)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": PREPROCESS_USER},
        ]
        text = await chat(messages, interrogation.model)
        manuscript, ended, question = parse_segments(text)
        if ended:
            raise LLMError("预处理阶段不应输出结束标记 true")

        db.add(
            models.ManuscriptEntry(
                interrogation_id=interrogation.id,
                index=0,
                kind="first_impression",
                content=manuscript,
            )
        )
        db.add(
            models.Turn(
                interrogation_id=interrogation.id,
                index=0,
                question=question,
                answer=None,
            )
        )
        interrogation.status = "ready"
        interrogation.ended = False
        interrogation.error = None
        db.commit()
    except Exception as exc:
        db.rollback()
        failed = db.get(models.Interrogation, interrogation_id)
        if failed is not None:
            failed.status = "failed"
            failed.error = str(exc)
            db.commit()
    finally:
        db.close()


def validate_answerable(interrogation_id: str, turn_index: int) -> None:
    db = SessionLocal()
    try:
        interrogation, turns = _load_answer_state(db, interrogation_id)
        _ensure_answerable(interrogation, turns, turn_index)
    finally:
        db.close()


async def stream_answer(
    interrogation_id: str,
    turn_index: int,
    answer: str,
) -> AsyncIterator[str]:
    db = SessionLocal()
    previous_status: str | None = None
    answer_saved = False
    try:
        interrogation, turns = _load_answer_state(db, interrogation_id)
        _ensure_answerable(interrogation, turns, turn_index)

        previous_status = interrogation.status
        _claim_turn_answer(db, interrogation_id, turn_index, answer)
        answer_saved = True

        messages = _build_turn_messages(db, interrogation_id, turn_index)
        parser = SegmentStreamParser()

        async for chunk in stream_chat(messages, interrogation.model):
            for segment, text in parser.feed(chunk):
                if text:
                    yield _segment_event(segment, parser.ended, text)

        for segment, text in parser.finish():
            if text:
                yield _segment_event(segment, parser.ended, text)

        manuscript, ended, question_text = parser.result()
        manuscript_index = turn_index + 1

        refreshed = db.get(models.Interrogation, interrogation_id)
        if refreshed is None:
            raise HTTPException(
                status_code=404,
                detail={"code": "interrogation_not_found", "message": "拷问不存在"},
        )

        if ended:
            guide_coro = _prepare_guide_generation(interrogation_id)
            db.add(
                models.ManuscriptEntry(
                    interrogation_id=interrogation_id,
                    index=manuscript_index,
                    kind="closing",
                    content=manuscript,
                )
            )
            refreshed.ended = True
            refreshed.status = "ended"
            refreshed.closing_message = question_text
            _ensure_guide_placeholder(db, interrogation_id)
            try:
                db.commit()
            except Exception:
                if guide_coro is not None:
                    guide_coro.close()
                raise
            if guide_coro is not None:
                asyncio.create_task(guide_coro)
            yield sse(
                "done",
                {
                    "ended": True,
                    "manuscript_index": manuscript_index,
                    "next_turn_index": None,
                },
            )
        else:
            db.add(
                models.ManuscriptEntry(
                    interrogation_id=interrogation_id,
                    index=manuscript_index,
                    kind="reaction",
                    content=manuscript,
                )
            )
            db.add(
                models.Turn(
                    interrogation_id=interrogation_id,
                    index=manuscript_index,
                    question=question_text,
                    answer=None,
                )
            )
            refreshed.status = "in_progress"
            refreshed.ended = False
            try:
                db.commit()
            except IntegrityError as exc:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "turn_conflict",
                        "message": "回答轮次与当前问题不一致",
                    },
                ) from exc
            yield sse(
                "done",
                {
                    "ended": False,
                    "manuscript_index": manuscript_index,
                    "next_turn_index": manuscript_index,
                },
            )
    except HTTPException as exc:
        db.rollback()
        if answer_saved:
            _rollback_answer(db, interrogation_id, turn_index, previous_status, answer)
        yield _http_error_sse(exc)
    except Exception as exc:
        db.rollback()
        if answer_saved:
            _rollback_answer(db, interrogation_id, turn_index, previous_status, answer)
        code = "llm_failed" if isinstance(exc, LLMError) else "internal_error"
        message = "模型生成失败" if isinstance(exc, LLMError) else "拷问生成失败"
        yield sse("error", {"code": code, "message": message})
    finally:
        db.close()


class SegmentStreamParser:
    _TAIL = 16

    def __init__(self) -> None:
        self.buffer = ""
        self.state = "start"
        self.ended: bool | None = None
        self.manuscript_parts: list[str] = []
        self.question_parts: list[str] = []

    def feed(self, chunk: str) -> list[tuple[str, str]]:
        self.buffer += chunk
        out: list[tuple[str, str]] = []

        while True:
            if self.state == "start":
                marker = "[手稿]\n"
                index = self.buffer.find(marker)
                if index < 0:
                    self.buffer = self.buffer[-self._TAIL :]
                    return out
                self.buffer = self.buffer[index + len(marker) :]
                self.state = "manuscript"
                continue

            if self.state == "manuscript":
                marker = "\n[结束]\n"
                index = self.buffer.find(marker)
                if index >= 0:
                    self._append(out, "manuscript", self.buffer[:index])
                    self.buffer = self.buffer[index + len(marker) :]
                    self.state = "ended"
                    continue
                if len(self.buffer) > self._TAIL:
                    self._append(out, "manuscript", self.buffer[: -self._TAIL])
                    self.buffer = self.buffer[-self._TAIL :]
                return out

            if self.state == "ended":
                if "\n" not in self.buffer:
                    return out
                line, self.buffer = self.buffer.split("\n", 1)
                value = line.strip().lower()
                if value not in {"true", "false"}:
                    return out
                self.ended = value == "true"
                self.state = "question_marker"
                continue

            if self.state == "question_marker":
                marker = "[问题]\n"
                trimmed = self.buffer.lstrip("\r\n")
                if trimmed.startswith(marker):
                    self.buffer = trimmed[len(marker) :]
                    self.state = "question"
                    continue
                index = trimmed.find(marker)
                if index >= 0:
                    self.buffer = trimmed[index + len(marker) :]
                    self.state = "question"
                    continue
                return out

            if self.state == "question":
                self._append(out, "question", self.buffer)
                self.buffer = ""
                return out

        return out

    def finish(self) -> list[tuple[str, str]]:
        out: list[tuple[str, str]] = []
        if self.state == "manuscript" and self.buffer:
            self._append(out, "manuscript", self.buffer)
            self.buffer = ""
            raise LLMError("LLM 返回内容不符合拷问分段格式")
        if self.state == "question" and self.buffer:
            self._append(out, "question", self.buffer)
            self.buffer = ""
        if self.state != "question" or self.ended is None:
            raise LLMError("LLM 返回内容不符合拷问分段格式")
        if not self.manuscript_text.strip() or not self.question_text.strip():
            raise LLMError("LLM 返回内容不符合拷问分段格式")
        return out

    def result(self) -> tuple[str, bool, str]:
        if self.state != "question" or self.ended is None:
            raise LLMError("LLM 返回内容不符合拷问分段格式")
        manuscript = self.manuscript_text.strip("\n")
        question = self.question_text.strip("\n")
        if not manuscript.strip() or not question.strip():
            raise LLMError("LLM 返回内容不符合拷问分段格式")
        return manuscript, self.ended, question

    @property
    def manuscript_text(self) -> str:
        return "".join(self.manuscript_parts)

    @property
    def question_text(self) -> str:
        return "".join(self.question_parts)

    def _append(self, out: list[tuple[str, str]], segment: str, text: str) -> None:
        if not text:
            return
        if segment == "manuscript":
            self.manuscript_parts.append(text)
        else:
            self.question_parts.append(text)
        out.append((segment, text))


def _segment_event(segment: str, ended: bool | None, text: str) -> str:
    if segment == "manuscript":
        return sse("manuscript_delta", {"text": text})
    event = "closing_delta" if ended else "question_delta"
    return sse(event, {"text": text})


def _http_error_sse(exc: HTTPException) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "http_error"))
        message = str(detail.get("message", "请求失败"))
    else:
        code = "http_error"
        message = str(detail)
    return sse("error", {"code": code, "message": message})


def _load_answer_state(db, interrogation_id: str):
    interrogation = db.get(models.Interrogation, interrogation_id)
    if interrogation is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "interrogation_not_found", "message": "拷问不存在"},
        )
    turns = list(
        db.scalars(
            select(models.Turn)
            .where(models.Turn.interrogation_id == interrogation_id)
            .order_by(models.Turn.index)
        )
    )
    return interrogation, turns


def _ensure_answerable(interrogation, turns: list[models.Turn], turn_index: int) -> None:
    if interrogation.status not in {"ready", "in_progress"}:
        raise HTTPException(
            status_code=409,
            detail={"code": "not_answerable", "message": "当前拷问状态不可回答"},
        )
    has_earlier_gap = any(turn.answer is None for turn in turns[:-1])
    if (
        not turns
        or has_earlier_gap
        or turns[-1].index != turn_index
        or turns[-1].answer is not None
    ):
        raise HTTPException(
            status_code=409,
            detail={"code": "turn_conflict", "message": "回答轮次与当前问题不一致"},
        )


def _claim_turn_answer(
    db,
    interrogation_id: str,
    turn_index: int,
    answer: str,
) -> None:
    status_updated = db.execute(
        update(models.Interrogation)
        .where(
            models.Interrogation.id == interrogation_id,
            models.Interrogation.status.in_(("ready", "in_progress")),
        )
        .values(status="in_progress", error=None)
    ).rowcount
    if status_updated != 1:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "not_answerable", "message": "当前拷问状态不可回答"},
        )

    answer_updated = db.execute(
        update(models.Turn)
        .where(
            models.Turn.interrogation_id == interrogation_id,
            models.Turn.index == turn_index,
            models.Turn.answer.is_(None),
        )
        .values(answer=answer)
    ).rowcount
    if answer_updated != 1:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "turn_conflict", "message": "回答轮次与当前问题不一致"},
        )

    db.commit()


def _build_turn_messages(db, interrogation_id: str, turn_index: int) -> list[dict]:
    interrogation = db.get(models.Interrogation, interrogation_id)
    if interrogation is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "interrogation_not_found", "message": "拷问不存在"},
        )

    system = _render_system(
        interrogation,
        interrogation.project,
        interrogation.project.resume,
    )
    turns = list(
        db.scalars(
            select(models.Turn)
            .where(models.Turn.interrogation_id == interrogation_id)
            .order_by(models.Turn.index)
        )
    )
    manuscript = {
        item.index: item.content
        for item in db.scalars(
            select(models.ManuscriptEntry)
            .where(models.ManuscriptEntry.interrogation_id == interrogation_id)
            .order_by(models.ManuscriptEntry.index)
        )
    }

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": PREPROCESS_USER},
    ]
    for turn in turns:
        if turn.index > turn_index:
            break
        if turn.answer is None:
            break
        if turn.index not in manuscript:
            raise LLMError("缺少可重建的面试官历史手稿")
        messages.append(
            {
                "role": "assistant",
                "content": _rebuild(manuscript[turn.index], False, turn.question),
            }
        )
        messages.append({"role": "user", "content": turn.answer})
    return messages


def _render_system(
    interrogation: models.Interrogation,
    project: models.Project,
    resume: models.Resume,
) -> str:
    return render(
        "interrogation",
        resume_summary=_resume_summary_text(resume.summary_json),
        project_name=project.name,
        project_description=project.raw_description,
        prev_summary_block=_prev_summary_block(interrogation.prev_summary),
    )


def _resume_summary_text(summary_json: dict | None) -> str:
    if not isinstance(summary_json, dict):
        return ""

    lines: list[str] = []
    headline = summary_json.get("headline")
    if headline:
        lines.append(str(headline))

    items = summary_json.get("items")
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            label = item.get("label")
            value = item.get("value")
            if label and value:
                lines.append(f"{label}: {value}")
    return "\n".join(lines)


def _prev_summary_block(prev_summary: str | None) -> str:
    if not prev_summary:
        return ""
    return "# 上一轮拷打回顾(供你参考,避免重复、可针对薄弱处加深)\n" + prev_summary


def _rebuild(manuscript: str, ended: bool, question: str) -> str:
    return f"[手稿]\n{manuscript}\n[结束]\n{'true' if ended else 'false'}\n[问题]\n{question}"


def _ensure_guide_placeholder(db, interrogation_id: str) -> None:
    guide = db.scalar(
        select(models.Guide).where(models.Guide.interrogation_id == interrogation_id)
    )
    if guide is None:
        db.add(models.Guide(interrogation_id=interrogation_id, status="generating"))


def _prepare_guide_generation(
    interrogation_id: str,
) -> Coroutine[Any, Any, Any] | None:
    if importlib.util.find_spec("app.services.guide_service") is None:
        return None
    from app.services import guide_service

    generate_for = getattr(guide_service, "generate_for", None)
    if generate_for is None:
        return None
    guide_coro = generate_for(interrogation_id)
    if not asyncio.iscoroutine(guide_coro):
        raise LLMError("指南生成接缝未返回协程")
    return guide_coro


def _rollback_answer(
    db,
    interrogation_id: str,
    turn_index: int,
    previous_status: str | None,
    answer: str,
) -> None:
    try:
        interrogation = db.get(models.Interrogation, interrogation_id)
        turn = db.scalar(
            select(models.Turn).where(
                models.Turn.interrogation_id == interrogation_id,
                models.Turn.index == turn_index,
            )
        )
        if interrogation is not None and previous_status is not None:
            interrogation.status = previous_status
        if turn is not None and turn.answer == answer:
            turn.answer = None
        db.commit()
    except Exception:
        db.rollback()
