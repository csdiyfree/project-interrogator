import { useEffect, useRef, useState } from 'react';

export interface PollingOptions<T> {
  /** 轮询间隔(ms),默认 1200。 */
  interval?: number;
  /** 为 false 时暂停轮询。 */
  enabled?: boolean;
  /** 返回 true 时停止轮询(达到终态)。 */
  stopWhen?: (data: T) => boolean;
  /** 变化时重置并重新拉取(通常传路由 id)。 */
  resetKey?: unknown;
}

export interface PollingState<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

/**
 * 通用轮询 hook:首拉立即执行,之后每隔 interval 重拉,直到 stopWhen 命中或出错。
 * fetcher 与 stopWhen 通过 ref 保活,避免每次渲染重订阅。
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { interval = 1200, enabled = true, stopWhen, resetKey }: PollingOptions<T> = {},
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const stopRef = useRef(stopWhen);
  stopRef.current = stopWhen;

  useEffect(() => {
    setData(null);
    setError(null);
    if (!enabled) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const d = await fetcherRef.current();
        if (!active) return;
        setData(d);
        setError(null);
        if (stopRef.current?.(d)) return;
      } catch (e) {
        if (!active) return;
        const err = e as { code?: string; message?: string };
        setError({ code: err.code ?? 'error', message: err.message ?? '' });
        return;
      }
      timer = setTimeout(tick, interval);
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, resetKey]);

  return { data, error };
}
