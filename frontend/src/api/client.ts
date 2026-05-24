import { getSessionId } from '../lib/session';
import type { AnswerHandlers, ApiErrorBody } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

/** 携带契约 §0 错误码的请求错误。 */
export class ApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

async function readError(res: Response): Promise<ApiRequestError> {
  let code = 'http_error';
  let message = res.statusText;
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error) {
      code = body.error.code;
      message = body.error.message;
    }
  } catch {
    /* 响应非 JSON,沿用状态文本 */
  }
  return new ApiRequestError(code, message);
}

/**
 * 普通 JSON 请求。自动拼 VITE_API_BASE、注入 X-Session-Id;
 * FormData 不强制 Content-Type(交给浏览器带 boundary)。
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('X-Session-Id', getSessionId());
  const isForm = options.body instanceof FormData;
  if (options.body && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(BASE + path, { ...options, headers });
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * SSE 流式请求(仅 POST .../answer)。手写解析:按 `\n\n` 切分事件,
 * 逐行解析 `event:` 与 `data:`,据契约 §5 分派到 handlers。
 */
export async function apiSSE(
  path: string,
  body: unknown,
  handlers: AnswerHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId(),
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    handlers.onError?.({ code: 'network_error', message: String(e) });
    return;
  }

  if (!res.ok || !res.body) {
    const err = await readError(res);
    handlers.onError?.({ code: err.code, message: err.message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatch(rawEvent, handlers);
    }
  }
  if (buffer.trim()) dispatch(buffer, handlers);
}

function dispatch(raw: string, handlers: AnswerHandlers): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return;

  let data: unknown;
  try {
    data = JSON.parse(dataLines.join('\n'));
  } catch {
    return;
  }

  switch (event) {
    case 'manuscript_delta':
      handlers.onManuscript?.(data as { text: string });
      break;
    case 'question_delta':
      handlers.onQuestion?.(data as { text: string });
      break;
    case 'closing_delta':
      handlers.onClosing?.(data as { text: string });
      break;
    case 'done':
      handlers.onDone?.(data as Parameters<NonNullable<AnswerHandlers['onDone']>>[0]);
      break;
    case 'error':
      handlers.onError?.(data as { code: string; message: string });
      break;
  }
}
