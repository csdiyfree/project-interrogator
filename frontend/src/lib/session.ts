const KEY = 'session_id';
const LAST = 'last_resume_id';

/** 登录令牌(作为 X-Session-Id)。未登录返回空串(不再自动生成)。 */
export function getSessionId(): string {
  return localStorage.getItem(KEY) ?? '';
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem(KEY);
}

/** 登录成功后写入后端下发的令牌。 */
export function setSession(token: string): void {
  localStorage.setItem(KEY, token);
}

/** 登出:清除令牌与「上次打开的简历」,避免跨用户残留。 */
export function clearSession(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LAST);
}

/** 记忆上次打开的简历(v02 多简历:刷新 / 回到首页时直达)。 */
export function getLastResumeId(): string | null {
  return localStorage.getItem(LAST);
}

export function setLastResumeId(id: string): void {
  localStorage.setItem(LAST, id);
}
