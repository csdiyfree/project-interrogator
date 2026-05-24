const KEY = 'session_id';

/** 读取(无则生成并持久化)匿名会话 id。所有请求带 X-Session-Id。 */
export function getSessionId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
