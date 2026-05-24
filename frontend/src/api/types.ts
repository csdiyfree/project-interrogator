// 由 develop_prompt/v01/01_接口契约.md 逐字翻译的 TS 类型。
// 字段命名与后端 JSON 严格一致(snake_case)。

/* ── §1 状态机枚举 ── */
export type ResumeStatus = 'parsing' | 'parsed' | 'failed';
export type InterrogationStatus =
  | 'preprocessing'
  | 'ready'
  | 'in_progress'
  | 'ended'
  | 'failed';
export type GuideStatus = 'generating' | 'ready' | 'failed';
export type TrafficLight = 'red' | 'yellow' | 'green';
export type ManuscriptKind = 'first_impression' | 'reaction' | 'closing';
export type TodoCategory = 'resume_fix' | 'knowledge_prep' | 'other';

/* ── §2 M1 简历解析 ── */
export interface SummaryItem {
  label: string;
  value: string;
}

export interface ResumeSummary {
  headline: string;
  items: SummaryItem[];
}

export interface InterrogationBrief {
  id: string;
  status: InterrogationStatus;
}

export interface ProjectInResume {
  id: string;
  name: string;
  raw_description: string;
  order_index: number;
  current_interrogation: InterrogationBrief | null;
}

export interface ResumeDetail {
  id: string;
  name: string | null;
  status: ResumeStatus;
  summary: ResumeSummary | null;
  projects: ProjectInResume[];
  error: string | null;
}

export interface CreateResumeResponse {
  resume_id: string;
}

/** GET /api/resumes 列表项(v02 多简历)。 */
export interface ResumeListItem {
  id: string;
  name: string | null;
  status: ResumeStatus;
  created_at: string;
}

export interface ResumesList {
  resumes: ResumeListItem[];
}

/* ── §3 M2 拷问 ── */
export interface InterrogationListItem {
  id: string;
  round_number: number;
  status: InterrogationStatus;
  ended: boolean;
  has_guide: boolean;
  created_at: string;
}

export interface ProjectDetail {
  id: string;
  resume_id: string;
  name: string;
  raw_description: string;
  order_index: number;
  current_interrogation_id: string;
  interrogations: InterrogationListItem[];
}

export interface ManuscriptEntry {
  index: number;
  kind: ManuscriptKind;
  content: string;
  created_at: string;
}

export interface Turn {
  index: number;
  question: string;
  answer: string | null;
  created_at: string;
}

export interface InterrogationDetail {
  id: string;
  project_id: string;
  round_number: number;
  status: InterrogationStatus;
  ended: boolean;
  prev_round_number: number | null;
  model: string;
  manuscript: ManuscriptEntry[];
  turns: Turn[];
  closing_message: string | null;
  error: string | null;
}

export interface ReinterrogateResponse {
  interrogation_id: string;
}

export interface ModelsResponse {
  models: string[];
  default: string;
}

/* ── §4 M3 改进指南 ── */
export interface Todo {
  id: string;
  category: TodoCategory;
  content: string;
  done: boolean;
  order_index: number;
}

export interface GuideDetail {
  id: string;
  interrogation_id: string;
  status: GuideStatus;
  traffic_light: TrafficLight | null;
  overview: string | null;
  todos: Todo[];
  error: string | null;
}

/* ── §5 SSE 事件 payload ── */
export interface DeltaEvent {
  text: string;
}

export interface DoneEvent {
  ended: boolean;
  manuscript_index: number;
  next_turn_index: number | null;
}

export interface SSEErrorEvent {
  code: string;
  message: string;
}

/** POST .../answer 的 SSE 回调集合(对应契约 §5 的 5 个事件)。 */
export interface AnswerHandlers {
  onManuscript?: (e: DeltaEvent) => void;
  onQuestion?: (e: DeltaEvent) => void;
  onClosing?: (e: DeltaEvent) => void;
  onDone?: (e: DoneEvent) => void;
  onError?: (e: SSEErrorEvent) => void;
}

/* ── §0 统一错误 ── */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
