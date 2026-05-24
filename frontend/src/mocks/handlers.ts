// Mock 处理器:内存态 store + 真实时序模拟,让 FE1/2/3 脱离后端跑通完整体验。
// 用 elapsed time 判定状态流转(parsing→parsed / preprocessing→ready / generating→ready)。
// 预置一份「种子简历」+ 固定 id 的拷问,便于 FE2/FE3 直接深链调试(刷新后种子恒在)。

import { ApiRequestError } from '../api/client';
import type {
  AnswerHandlers,
  CreateResumeResponse,
  GuideDetail,
  InterrogationDetail,
  InterrogationStatus,
  LoginResponse,
  ManuscriptEntry,
  ModelsResponse,
  ProjectDetail,
  ReinterrogateResponse,
  ResumeDetail,
  ResumeListItem,
  ResumeStatus,
  ResumesList,
  Todo,
  Turn,
} from '../api/types';
import {
  MODELS,
  PROJECT_TEMPLATES,
  RESUME_SUMMARY,
  SCRIPTS,
  type ProjectTemplate,
} from './fixtures';

/* ── 时序常量 ── */
const PARSE_MS = 1500; // 简历 parsing → parsed
const PREPROCESS_MS = 1800; // 拷问 preprocessing → ready
const GUIDE_MS = 2000; // 指南 generating → ready
const PAST = -1e12; // 远古时间戳,使种子实体立即处于终态

/* ── 内存模型 ── */
interface MGuide {
  id: string;
  created_at_ms: number;
  traffic_light: GuideDetail['traffic_light'];
  overview: string;
  todos: Todo[];
}
interface MInterrogation {
  id: string;
  project_id: string;
  round_number: number;
  created_at_ms: number;
  created_at_iso: string;
  model: string;
  prev_round_number: number | null;
  manuscript: ManuscriptEntry[];
  turns: Turn[];
  ended: boolean;
  closing_message: string | null;
  guide: MGuide | null;
}
interface MProject {
  id: string;
  resume_id: string;
  name: string;
  raw_description: string;
  order_index: number;
  script_key: string;
  interrogations: MInterrogation[];
}
interface MResume {
  id: string;
  name: string;
  created_at_ms: number;
  created_at_iso: string;
  projects: MProject[];
}

const resumes = new Map<string, MResume>();
const projects = new Map<string, MProject>();
const interrogations = new Map<string, MInterrogation>();
const todos = new Map<string, Todo>();

/* ── 工具 ── */
const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reject = (code: string, message: string) =>
  Promise.reject(new ApiRequestError(code, message));

async function streamText(
  text: string,
  emit: (t: string) => void,
  { chunk = 8, delay = 32 }: { chunk?: number; delay?: number } = {},
): Promise<void> {
  for (let i = 0; i < text.length; i += chunk) {
    await sleep(delay);
    emit(text.slice(i, i + chunk));
  }
}

const scriptKeyOf = (it: MInterrogation) => projects.get(it.project_id)!.script_key;
const latestRound = (p: MProject) =>
  p.interrogations.reduce((a, b) => (b.round_number > a.round_number ? b : a));

/* ── v02 简历命名 ── */
const CANDIDATE =
  RESUME_SUMMARY.items.find((i) => i.label === '姓名')?.value ?? RESUME_SUMMARY.headline;

function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}月${p(d.getDate())}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 同会话内重名追加 (1)/(2)…。 */
function uniqueName(base: string): string {
  const existing = new Set([...resumes.values()].map((r) => r.name));
  if (!existing.has(base)) return base;
  let n = 1;
  while (existing.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

function resumeStatus(r: MResume): ResumeStatus {
  return Date.now() - r.created_at_ms < PARSE_MS ? 'parsing' : 'parsed';
}

function toListItem(r: MResume): ResumeListItem {
  return { id: r.id, name: r.name, status: resumeStatus(r), created_at: r.created_at_iso };
}

function createInterrogation(
  project: MProject,
  round: number,
  createdMs: number,
  prevRound: number | null,
  fixedId?: string,
): MInterrogation {
  const it: MInterrogation = {
    id: fixedId ?? uid(),
    project_id: project.id,
    round_number: round,
    created_at_ms: createdMs,
    created_at_iso: nowIso(),
    model: MODELS.default,
    prev_round_number: prevRound,
    manuscript: [],
    turns: [],
    ended: false,
    closing_message: null,
    guide: null,
  };
  project.interrogations.push(it);
  interrogations.set(it.id, it);
  return it;
}

/** 预处理完成后惰性填充初印象 + 首问。 */
function ensureInitialized(it: MInterrogation): void {
  if (it.manuscript.length > 0 || it.ended) return;
  const script = SCRIPTS[scriptKeyOf(it)];
  it.manuscript.push({
    index: 0,
    kind: 'first_impression',
    content: script.first_impression,
    created_at: it.created_at_iso,
  });
  it.turns.push({
    index: 0,
    question: script.first_question,
    answer: null,
    created_at: it.created_at_iso,
  });
}

function statusOf(it: MInterrogation): InterrogationStatus {
  if (!it.ended && it.manuscript.length === 0 && Date.now() - it.created_at_ms < PREPROCESS_MS) {
    return 'preprocessing';
  }
  ensureInitialized(it);
  if (it.ended) return 'ended';
  if (it.turns.some((t) => t.answer !== null)) return 'in_progress';
  return 'ready';
}

function ensureGuide(it: MInterrogation, createdMs = Date.now()): MGuide {
  if (it.guide) return it.guide;
  const spec = SCRIPTS[scriptKeyOf(it)].guide;
  const guide: MGuide = {
    id: uid(),
    created_at_ms: createdMs,
    traffic_light: spec.traffic_light,
    overview: spec.overview,
    todos: spec.todos.map((t, i) => {
      const todo: Todo = {
        id: uid(),
        category: t.category,
        content: t.content,
        done: false,
        order_index: i,
      };
      todos.set(todo.id, todo);
      return todo;
    }),
  };
  it.guide = guide;
  return guide;
}

function toDetail(it: MInterrogation): InterrogationDetail {
  const status = statusOf(it);
  const preprocessing = status === 'preprocessing';
  return {
    id: it.id,
    project_id: it.project_id,
    round_number: it.round_number,
    status,
    ended: it.ended,
    prev_round_number: it.prev_round_number,
    model: it.model,
    manuscript: preprocessing ? [] : it.manuscript.map((m) => ({ ...m })),
    turns: preprocessing ? [] : it.turns.map((t) => ({ ...t })),
    closing_message: it.closing_message,
    error: null,
  };
}

/* ── 种子数据 ── */
function buildCompleted(
  project: MProject,
  round: number,
  prevRound: number | null,
  fixedId: string,
): MInterrogation {
  const it = createInterrogation(project, round, PAST, prevRound, fixedId);
  const script = SCRIPTS[project.script_key];
  it.manuscript.push({
    index: 0,
    kind: 'first_impression',
    content: script.first_impression,
    created_at: nowIso(),
  });
  it.turns.push({
    index: 0,
    question: script.first_question,
    answer: script.sample_answers[0] ?? '（示例回答）',
    created_at: nowIso(),
  });
  script.exchanges.forEach((ex, i) => {
    if (it.ended) return;
    const mi = i + 1;
    const ended = ex.question == null;
    it.manuscript.push({
      index: mi,
      kind: ended ? 'closing' : 'reaction',
      content: ex.reaction,
      created_at: nowIso(),
    });
    if (ended) {
      it.ended = true;
      it.closing_message = script.closing;
    } else {
      it.turns.push({
        index: mi,
        question: ex.question!,
        answer: script.sample_answers[mi] ?? '（示例回答）',
        created_at: nowIso(),
      });
    }
  });
  ensureGuide(it, PAST);
  return it;
}

function seedProject(
  fixedId: string,
  tpl: ProjectTemplate,
  resumeId: string,
  order: number,
): MProject {
  const p: MProject = {
    id: fixedId,
    resume_id: resumeId,
    name: tpl.name,
    raw_description: tpl.raw_description,
    order_index: order,
    script_key: tpl.script_key,
    interrogations: [],
  };
  projects.set(p.id, p);
  return p;
}

(function seed() {
  const resumeId = 'seed-resume';
  const resume: MResume = {
    id: resumeId,
    name: `示例简历 · ${CANDIDATE}`,
    created_at_ms: PAST,
    created_at_iso: nowIso(),
    projects: [],
  };
  resumes.set(resumeId, resume);

  // 项目一(分割):一轮 ready、可作答 —— FE2 实时 SSE 深链
  const seg = seedProject('seed-proj-seg', PROJECT_TEMPLATES[0], resumeId, 0);
  ensureInitialized(createInterrogation(seg, 1, PAST, null, 'seed-it-seg'));
  resume.projects.push(seg);

  // 项目二(检索):一轮 ready、可作答
  const ret = seedProject('seed-proj-ret', PROJECT_TEMPLATES[1], resumeId, 1);
  ensureInitialized(createInterrogation(ret, 1, PAST, null, 'seed-it-ret'));
  resume.projects.push(ret);

  // 项目三(异常检测):两轮已结束 + 指南 —— FE3 历史切换深链
  const ano = seedProject('seed-proj-ano', PROJECT_TEMPLATES[2], resumeId, 2);
  buildCompleted(ano, 1, null, 'seed-it-ano-1');
  buildCompleted(ano, 2, 1, 'seed-it-ano-2');
  resume.projects.push(ano);
})();

function buildResume(): MResume {
  const id = uid();
  const now = new Date();
  const createdMs = now.getTime();
  const resume: MResume = {
    id,
    name: uniqueName(`${CANDIDATE} ${formatStamp(now)}`),
    created_at_ms: createdMs,
    created_at_iso: now.toISOString(),
    projects: [],
  };
  PROJECT_TEMPLATES.forEach((tpl, i) => {
    const p = seedProject(uid(), tpl, id, i);
    createInterrogation(p, 1, createdMs, null);
    resume.projects.push(p);
  });
  resumes.set(id, resume);
  return resume;
}

/* ── v03 登录(写死账号,与后端同一组凭据) ── */
const MOCK_USERS: Record<string, { password: string; session_id: string }> = {
  admin: { password: 'kaoda-2025-admin', session_id: 'sess-admin-9f3c1a2b8e7d' },
  guest: { password: 'kaoda-2025-guest', session_id: 'sess-guest-4a6d2e9c1b07' },
};

export function login(username: string, password: string): Promise<LoginResponse> {
  const u = MOCK_USERS[username];
  if (!u || u.password !== password) return reject('invalid_credentials', '账号或密码错误');
  return sleep(120).then(() => ({ session_id: u.session_id }));
}

/* ── M1 简历 ── */
export function createResumeText(text: string): Promise<CreateResumeResponse> {
  if (!text || !text.trim()) return reject('empty_input', '文本为空');
  return sleep(120).then(() => ({ resume_id: buildResume().id }));
}

export function createResumeFile(file: File): Promise<CreateResumeResponse> {
  if (!file) return reject('empty_input', '无文件');
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    return reject('bad_file', '仅支持 PDF');
  }
  return sleep(180).then(() => ({ resume_id: buildResume().id }));
}

export function getResume(resumeId: string): Promise<ResumeDetail> {
  const r = resumes.get(resumeId);
  if (!r) return reject('not_found', 'resume 不存在');
  return sleep(90).then(() => {
    if (Date.now() - r.created_at_ms < PARSE_MS) {
      return { id: r.id, name: r.name, status: 'parsing', summary: null, projects: [], error: null };
    }
    return {
      id: r.id,
      name: r.name,
      status: 'parsed',
      summary: RESUME_SUMMARY,
      projects: r.projects.map((p) => {
        const latest = latestRound(p);
        return {
          id: p.id,
          name: p.name,
          raw_description: p.raw_description,
          order_index: p.order_index,
          current_interrogation: { id: latest.id, status: statusOf(latest) },
        };
      }),
      error: null,
    };
  });
}

/** 列出运行时创建的简历(排除内置 seed-resume,使全新会话 = 空列表)。 */
export function listResumes(): Promise<ResumesList> {
  return sleep(90).then(() => ({
    resumes: [...resumes.values()]
      .filter((r) => r.id !== 'seed-resume')
      .sort((a, b) => b.created_at_ms - a.created_at_ms)
      .map(toListItem),
  }));
}

export function renameResume(resumeId: string, name: string): Promise<ResumeListItem> {
  const r = resumes.get(resumeId);
  if (!r) return reject('not_found', 'resume 不存在');
  const trimmed = name.trim();
  if (!trimmed) return reject('empty_input', '名称为空');
  return sleep(80).then(() => {
    r.name = trimmed;
    return toListItem(r);
  });
}

/* ── M2 拷问 ── */
export function getProject(projectId: string): Promise<ProjectDetail> {
  const p = projects.get(projectId);
  if (!p) return reject('not_found', 'project 不存在');
  return sleep(90).then(() => {
    const sorted = [...p.interrogations].sort((a, b) => b.round_number - a.round_number);
    return {
      id: p.id,
      resume_id: p.resume_id,
      name: p.name,
      raw_description: p.raw_description,
      order_index: p.order_index,
      current_interrogation_id: sorted[0].id,
      interrogations: sorted.map((it) => ({
        id: it.id,
        round_number: it.round_number,
        status: statusOf(it),
        ended: it.ended,
        has_guide: !!it.guide,
        created_at: it.created_at_iso,
      })),
    };
  });
}

export function getInterrogation(interrogationId: string): Promise<InterrogationDetail> {
  const it = interrogations.get(interrogationId);
  if (!it) return reject('not_found', 'interrogation 不存在');
  return sleep(90).then(() => toDetail(it));
}

export async function answer(
  interrogationId: string,
  turnIndex: number,
  answerText: string,
  handlers: AnswerHandlers,
): Promise<void> {
  const it = interrogations.get(interrogationId);
  if (!it) {
    handlers.onError?.({ code: 'not_found', message: 'interrogation 不存在' });
    return;
  }
  ensureInitialized(it);

  if (it.ended) {
    handlers.onError?.({ code: 'not_answerable', message: '本轮已结束' });
    return;
  }
  const last = it.turns[it.turns.length - 1];
  if (!last || last.index !== turnIndex || last.answer !== null) {
    handlers.onError?.({ code: 'turn_conflict', message: 'turn_index 不匹配' });
    return;
  }

  last.answer = answerText;

  const script = SCRIPTS[scriptKeyOf(it)];
  const ex = script.exchanges[turnIndex] ?? script.exchanges[script.exchanges.length - 1];
  const ended = ex.question == null;
  const manuscriptIndex = turnIndex + 1;

  await sleep(320);
  await streamText(ex.reaction, (t) => handlers.onManuscript?.({ text: t }));
  if (ended) {
    await streamText(script.closing, (t) => handlers.onClosing?.({ text: t }));
  } else {
    await streamText(ex.question!, (t) => handlers.onQuestion?.({ text: t }));
  }

  it.manuscript.push({
    index: manuscriptIndex,
    kind: ended ? 'closing' : 'reaction',
    content: ex.reaction,
    created_at: nowIso(),
  });

  if (ended) {
    it.ended = true;
    it.closing_message = script.closing;
    ensureGuide(it);
    handlers.onDone?.({ ended: true, manuscript_index: manuscriptIndex, next_turn_index: null });
  } else {
    it.turns.push({
      index: manuscriptIndex,
      question: ex.question!,
      answer: null,
      created_at: nowIso(),
    });
    handlers.onDone?.({
      ended: false,
      manuscript_index: manuscriptIndex,
      next_turn_index: manuscriptIndex,
    });
  }
}

export function reinterrogate(
  projectId: string,
  model?: string,
): Promise<ReinterrogateResponse> {
  const p = projects.get(projectId);
  if (!p) return reject('not_found', 'project 不存在');
  return sleep(150).then(() => {
    const max = latestRound(p).round_number;
    const it = createInterrogation(p, max + 1, Date.now(), max);
    if (model) it.model = model;
    return { interrogation_id: it.id };
  });
}

export function getModels(): Promise<ModelsResponse> {
  return sleep(60).then(() => ({ ...MODELS }));
}

/* ── M3 指南 ── */
export function getGuide(interrogationId: string): Promise<GuideDetail> {
  const it = interrogations.get(interrogationId);
  if (!it) return reject('guide_not_found', 'interrogation 不存在');
  if (!it.ended) return reject('guide_not_found', '本轮拷问尚未结束');
  return sleep(90).then(() => {
    const g = ensureGuide(it);
    const generating = Date.now() - g.created_at_ms < GUIDE_MS;
    return {
      id: g.id,
      interrogation_id: it.id,
      status: generating ? 'generating' : 'ready',
      traffic_light: generating ? null : g.traffic_light,
      overview: generating ? null : g.overview,
      todos: generating ? [] : g.todos.map((t) => ({ ...t })),
      error: null,
    };
  });
}

export function patchTodo(todoId: string, done: boolean): Promise<Todo> {
  const t = todos.get(todoId);
  if (!t) return reject('not_found', 'todo 不存在');
  return sleep(80).then(() => {
    t.done = done;
    return { ...t };
  });
}
