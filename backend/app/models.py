from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator[datetime]):
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    session_id: Mapped[str] = mapped_column(String, index=True)
    source: Mapped[str] = mapped_column(String)
    raw_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String)
    summary_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    projects: Mapped[list["Project"]] = relationship(back_populates="resume")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    raw_description: Mapped[str] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer)

    resume: Mapped["Resume"] = relationship(back_populates="projects")
    interrogations: Mapped[list["Interrogation"]] = relationship(back_populates="project")


class Interrogation(Base):
    __tablename__ = "interrogations"
    __table_args__ = (
        UniqueConstraint("project_id", "round_number", name="uq_interrogation_round"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String)
    prev_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    model: Mapped[str] = mapped_column(String)
    ended: Mapped[bool] = mapped_column(Boolean, default=False)
    closing_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="interrogations")
    manuscript_entries: Mapped[list["ManuscriptEntry"]] = relationship(
        back_populates="interrogation"
    )
    turns: Mapped[list["Turn"]] = relationship(back_populates="interrogation")
    guide: Mapped["Guide | None"] = relationship(back_populates="interrogation")


class ManuscriptEntry(Base):
    __tablename__ = "manuscript_entries"
    __table_args__ = (
        UniqueConstraint(
            "interrogation_id",
            "index",
            name="uq_manuscript_entry_index",
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    interrogation_id: Mapped[str] = mapped_column(ForeignKey("interrogations.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)

    interrogation: Mapped["Interrogation"] = relationship(back_populates="manuscript_entries")


class Turn(Base):
    __tablename__ = "turns"
    __table_args__ = (
        UniqueConstraint("interrogation_id", "index", name="uq_turn_index"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    interrogation_id: Mapped[str] = mapped_column(ForeignKey("interrogations.id"), index=True)
    index: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)

    interrogation: Mapped["Interrogation"] = relationship(back_populates="turns")


class Guide(Base):
    __tablename__ = "guides"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    interrogation_id: Mapped[str] = mapped_column(
        ForeignKey("interrogations.id"), unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String)
    traffic_light: Mapped[str | None] = mapped_column(String, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_for_next: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    interrogation: Mapped["Interrogation"] = relationship(back_populates="guide")
    todos: Mapped[list["Todo"]] = relationship(back_populates="guide")


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    guide_id: Mapped[str] = mapped_column(ForeignKey("guides.id"), index=True)
    category: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer)

    guide: Mapped["Guide"] = relationship(back_populates="todos")
