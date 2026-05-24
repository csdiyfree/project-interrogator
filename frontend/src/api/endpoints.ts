// 每个契约接口一个函数。内部据 VITE_USE_MOCK 切换真实请求 / mock。
// 页面层只 import 本文件,不直接 fetch。

import { apiFetch, apiSSE } from './client';
import * as mock from '../mocks/handlers';
import type {
  AnswerHandlers,
  CreateResumeResponse,
  GuideDetail,
  InterrogationDetail,
  ModelsResponse,
  ProjectDetail,
  ReinterrogateResponse,
  ResumeDetail,
  ResumeListItem,
  ResumesList,
  Todo,
} from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* ── M1 简历 ── */
export function createResumeText(text: string): Promise<CreateResumeResponse> {
  if (USE_MOCK) return mock.createResumeText(text);
  return apiFetch('/api/resumes', { method: 'POST', body: JSON.stringify({ text }) });
}

export function createResumeFile(file: File): Promise<CreateResumeResponse> {
  if (USE_MOCK) return mock.createResumeFile(file);
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/api/resumes', { method: 'POST', body: form });
}

export function getResume(resumeId: string): Promise<ResumeDetail> {
  if (USE_MOCK) return mock.getResume(resumeId);
  return apiFetch(`/api/resumes/${resumeId}`);
}

export function listResumes(): Promise<ResumesList> {
  if (USE_MOCK) return mock.listResumes();
  return apiFetch('/api/resumes');
}

export function renameResume(resumeId: string, name: string): Promise<ResumeListItem> {
  if (USE_MOCK) return mock.renameResume(resumeId, name);
  return apiFetch(`/api/resumes/${resumeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

/* ── M2 拷问 ── */
export function getProject(projectId: string): Promise<ProjectDetail> {
  if (USE_MOCK) return mock.getProject(projectId);
  return apiFetch(`/api/projects/${projectId}`);
}

export function getInterrogation(interrogationId: string): Promise<InterrogationDetail> {
  if (USE_MOCK) return mock.getInterrogation(interrogationId);
  return apiFetch(`/api/interrogations/${interrogationId}`);
}

/** 提交回答(SSE 流式)。回调见契约 §5。 */
export function answer(
  interrogationId: string,
  turnIndex: number,
  answerText: string,
  handlers: AnswerHandlers,
): Promise<void> {
  if (USE_MOCK) return mock.answer(interrogationId, turnIndex, answerText, handlers);
  return apiSSE(
    `/api/interrogations/${interrogationId}/answer`,
    { turn_index: turnIndex, answer: answerText },
    handlers,
  );
}

export function reinterrogate(
  projectId: string,
  model?: string,
): Promise<ReinterrogateResponse> {
  if (USE_MOCK) return mock.reinterrogate(projectId, model);
  return apiFetch(`/api/projects/${projectId}/reinterrogate`, {
    method: 'POST',
    body: JSON.stringify(model ? { model } : {}),
  });
}

export function getModels(): Promise<ModelsResponse> {
  if (USE_MOCK) return mock.getModels();
  return apiFetch('/api/models');
}

/* ── M3 指南 ── */
export function getGuide(interrogationId: string): Promise<GuideDetail> {
  if (USE_MOCK) return mock.getGuide(interrogationId);
  return apiFetch(`/api/interrogations/${interrogationId}/guide`);
}

export function patchTodo(todoId: string, done: boolean): Promise<Todo> {
  if (USE_MOCK) return mock.patchTodo(todoId, done);
  return apiFetch(`/api/todos/${todoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
}
