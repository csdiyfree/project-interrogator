import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app import models
from app.db import SessionLocal, init_db
from app.llm import client, stream_chat
from app.main import app


def chunk(text: str | None):
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=SimpleNamespace(content=text))]
    )


def empty_choices_chunk():
    return SimpleNamespace(choices=[])


async def fake_create(*args, **kwargs):
    async def stream():
        yield chunk("[手稿]\n")
        yield chunk("回答能对上首问,但关键数据仍需继续验证。")
        yield chunk("\n[结束]\nfalse\n[问题]\n")
        yield chunk("请给出这个指标的实际测量口径。")
        yield chunk(None)
        yield empty_choices_chunk()

    return stream()


async def verify_stream_chat() -> None:
    original_create = client.chat.completions.create
    client.chat.completions.create = fake_create
    try:
        chunks = [
            item
            async for item in stream_chat(
                [{"role": "user", "content": "test"}],
                model="test-model",
            )
        ]
    finally:
        client.chat.completions.create = original_create

    expected = [
        "[手稿]\n",
        "回答能对上首问,但关键数据仍需继续验证。",
        "\n[结束]\nfalse\n[问题]\n",
        "请给出这个指标的实际测量口径。",
    ]
    assert chunks == expected, chunks


def make_ready_interrogation(session_id: str) -> str:
    init_db()
    db = SessionLocal()
    try:
        resume = models.Resume(
            session_id=session_id,
            source="text",
            raw_text="测试简历",
            status="parsed",
            summary_json={"headline": "测试候选人", "items": []},
        )
        db.add(resume)
        db.flush()
        project = models.Project(
            resume_id=resume.id,
            name="测试项目",
            raw_description="测试项目描述",
            order_index=0,
        )
        db.add(project)
        db.flush()
        interrogation = models.Interrogation(
            project_id=project.id,
            round_number=1,
            status="ready",
            prev_summary=None,
            model="test-model",
            ended=False,
        )
        db.add(interrogation)
        db.flush()
        db.add(
            models.ManuscriptEntry(
                interrogation_id=interrogation.id,
                index=0,
                kind="first_impression",
                content="初印象",
            )
        )
        db.add(
            models.Turn(
                interrogation_id=interrogation.id,
                index=0,
                question="首问",
                answer=None,
            )
        )
        db.commit()
        return interrogation.id
    finally:
        db.close()


def verify_answer_endpoint() -> None:
    session_id = "verify-stream-chat-empty-choices"
    cleanup_session(session_id)
    interrogation_id = make_ready_interrogation(session_id)
    original_create = client.chat.completions.create
    client.chat.completions.create = fake_create
    try:
        with TestClient(app) as test_client:
            response = test_client.post(
                f"/api/interrogations/{interrogation_id}/answer",
                headers={"X-Session-Id": session_id},
                json={"turn_index": 0, "answer": "测试回答"},
            )
        body = response.text
    finally:
        client.chat.completions.create = original_create

    assert response.status_code == 200, response.text
    assert "event: error" not in body, body
    assert "event: done" in body, body
    assert '"ended": false' in body, body
    assert '"manuscript_index": 1' in body, body
    assert '"next_turn_index": 1' in body, body
    assert body.strip().endswith(
        'event: done\ndata: {"ended": false, "manuscript_index": 1, "next_turn_index": 1}'
    ), body

    db = SessionLocal()
    try:
        turns = list(
            db.scalars(
                select(models.Turn)
                .where(models.Turn.interrogation_id == interrogation_id)
                .order_by(models.Turn.index)
            )
        )
        manuscript = list(
            db.scalars(
                select(models.ManuscriptEntry)
                .where(models.ManuscriptEntry.interrogation_id == interrogation_id)
                .order_by(models.ManuscriptEntry.index)
            )
        )
        assert turns[0].answer == "测试回答"
        assert turns[1].index == 1
        assert turns[1].answer is None
        assert manuscript[1].index == 1
    finally:
        db.close()

    print("stream_chat ok")
    print("answer endpoint ok")
    print("db answer/manuscript[1]/turn[1] ok")
    print(body.strip())
    cleanup_session(session_id)


def cleanup_session(session_id: str) -> None:
    db = SessionLocal()
    try:
        resume_ids = list(
            db.scalars(select(models.Resume.id).where(models.Resume.session_id == session_id))
        )
        if not resume_ids:
            return
        project_ids = list(
            db.scalars(select(models.Project.id).where(models.Project.resume_id.in_(resume_ids)))
        )
        interrogation_ids = list(
            db.scalars(
                select(models.Interrogation.id).where(
                    models.Interrogation.project_id.in_(project_ids)
                )
            )
        )
        guide_ids = list(
            db.scalars(
                select(models.Guide.id).where(
                    models.Guide.interrogation_id.in_(interrogation_ids)
                )
            )
        )
        if guide_ids:
            db.execute(delete(models.Todo).where(models.Todo.guide_id.in_(guide_ids)))
        if interrogation_ids:
            db.execute(
                delete(models.ManuscriptEntry).where(
                    models.ManuscriptEntry.interrogation_id.in_(interrogation_ids)
                )
            )
            db.execute(
                delete(models.Turn).where(models.Turn.interrogation_id.in_(interrogation_ids))
            )
            db.execute(
                delete(models.Guide).where(
                    models.Guide.interrogation_id.in_(interrogation_ids)
                )
            )
            db.execute(
                delete(models.Interrogation).where(
                    models.Interrogation.id.in_(interrogation_ids)
                )
            )
        if project_ids:
            db.execute(delete(models.Project).where(models.Project.id.in_(project_ids)))
        db.execute(delete(models.Resume).where(models.Resume.id.in_(resume_ids)))
        db.commit()
    finally:
        db.close()


async def main() -> None:
    await verify_stream_chat()
    verify_answer_endpoint()


if __name__ == "__main__":
    asyncio.run(main())
