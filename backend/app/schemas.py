from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_serializer


def utc_isoformat(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", when_used="json", check_fields=False)
    def serialize_created_at(self, value: datetime) -> str:
        return utc_isoformat(value)


class ErrorDetail(APIModel):
    code: str
    message: str


class ErrorBody(APIModel):
    error: ErrorDetail


class SummaryItem(APIModel):
    label: str
    value: str


class ResumeSummary(APIModel):
    headline: str
    items: list[SummaryItem]


class CurrentInterrogation(APIModel):
    id: str
    status: str


class ProjectInResume(APIModel):
    id: str
    name: str
    raw_description: str
    order_index: int
    current_interrogation: CurrentInterrogation | None = None


class ResumeDetail(APIModel):
    id: str
    name: str | None = None
    status: str
    summary: ResumeSummary | None = None
    projects: list[ProjectInResume]
    error: str | None = None


class ResumeListItem(APIModel):
    id: str
    name: str | None = None
    status: str
    created_at: datetime


class ResumesList(APIModel):
    resumes: list[ResumeListItem]


class ResumeRename(APIModel):
    name: str


class CreateResumeText(APIModel):
    text: str


class CreateResumeResponse(APIModel):
    resume_id: str


class InterrogationBrief(APIModel):
    id: str
    round_number: int
    status: str
    ended: bool
    has_guide: bool
    created_at: datetime


class ProjectDetail(APIModel):
    id: str
    resume_id: str
    name: str
    raw_description: str
    order_index: int
    current_interrogation_id: str
    interrogations: list[InterrogationBrief]


class ManuscriptEntryOut(APIModel):
    index: int
    kind: str
    content: str
    created_at: datetime


class TurnOut(APIModel):
    index: int
    question: str
    answer: str | None = None
    created_at: datetime


class InterrogationDetail(APIModel):
    id: str
    project_id: str
    round_number: int
    status: str
    ended: bool
    prev_round_number: int | None = None
    model: str
    manuscript: list[ManuscriptEntryOut]
    turns: list[TurnOut]
    closing_message: str | None = None
    error: str | None = None


class AnswerRequest(APIModel):
    turn_index: int
    answer: str


class ReinterrogateRequest(APIModel):
    model: str | None = None


class ReinterrogateResponse(APIModel):
    interrogation_id: str


class ModelsResponse(APIModel):
    models: list[str]
    default: str


class TodoOut(APIModel):
    id: str
    category: str
    content: str
    done: bool
    order_index: int


class GuideDetail(APIModel):
    id: str
    interrogation_id: str
    status: str
    traffic_light: str | None = None
    overview: str | None = None
    todos: list[TodoOut]
    error: str | None = None


class TodoUpdate(APIModel):
    done: bool
