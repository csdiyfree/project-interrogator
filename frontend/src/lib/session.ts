const KEY = 'session_id';
const LAST = 'last_resume_id';

/** 读取(无则生成并持久化)匿名会话 id。所有请求带 X-Session-Id。 */
export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** 记忆上次打开的简历(v02 多简历:刷新 / 回到首页时直达)。 */
export function getLastResumeId(): string | null {
  return localStorage.getItem(LAST);
}

export function setLastResumeId(id: string): void {
  localStorage.setItem(LAST, id);
}
