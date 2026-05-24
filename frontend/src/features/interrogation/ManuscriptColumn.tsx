// 面试官手稿列(用户的上帝视角)。带标题、可折叠;条目顺序渲染,
// 流式期间末条逐字书写,自动滚动保持最新书写在视野内。
// 暖色平铺「笔记」面板,与左侧对话区(悬浮白气泡)形成视觉区分。

import { useEffect, useRef } from 'react';
import { Markdown } from '../../design/components';
import type { ManuscriptEntry } from '../../api/types';
import { ChevronIcon, ManuscriptIcon } from './parts';

interface Props {
  entries: ManuscriptEntry[];
  /** 正在书写的手稿增量(流式);为空亦可,配合 streaming 显示书写笔迹。 */
  live: string;
  streaming: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function ManuscriptColumn({ entries, live, streaming, collapsed, onToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [entries.length, live, streaming, collapsed]);

  // 流式中、或落库尚未追上(增量已满但 entries 未更新)时显示书写条目,避免闪烁。
  const showLive = streaming || live.length > 0;

  return (
    <aside className="lg:h-full lg:min-h-0">
      {/* 桌面端:折叠后的竖向把手,点按展开 */}
      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="expand-manuscript"
          className="hidden w-full flex-col items-center justify-center gap-3 rounded-lg bg-accent/5 py-5 text-ink-soft transition-colors hover:text-accent lg:flex lg:h-full"
        >
          <ChevronIcon className="rotate-180" />
          <span className="font-serif text-sm tracking-wider [writing-mode:vertical-rl]">面试官手稿</span>
        </button>
      )}

      {/* 面板:桌面端折叠时隐藏(改用竖把手);移动端始终保留标题,内容随折叠收起 */}
      <div
        className={`flex flex-col overflow-hidden rounded-lg bg-accent/5 lg:h-full lg:min-h-0 ${
          collapsed ? 'lg:hidden' : ''
        }`}
      >
        <header className="flex shrink-0 items-center gap-2.5 px-5 py-4 sm:px-6">
          <span className="text-accent">
            <ManuscriptIcon />
          </span>
          <h2 className="font-serif text-[0.97rem] text-ink">面试官手稿</h2>
          <button
            type="button"
            onClick={onToggle}
            aria-label="toggle-manuscript"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ChevronIcon className={collapsed ? 'rotate-180' : ''} />
          </button>
        </header>

        <div
          ref={scrollRef}
          className={`overflow-y-auto px-5 pb-6 pt-1 sm:px-6 lg:min-h-0 lg:flex-1 ${collapsed ? 'hidden' : ''}`}
        >
          {entries.map((m, i) => (
            <div key={m.index} className={i > 0 ? 'mt-6 border-t border-line pt-6' : ''}>
              <Markdown>{m.content}</Markdown>
            </div>
          ))}

          {showLive && (
            <div className={entries.length > 0 ? 'mt-6 border-t border-line pt-6' : ''}>
              {live && <Markdown>{live}</Markdown>}
              {streaming && (
                <span className="mt-2 block h-[3px] w-7 animate-blink rounded-full bg-accent" />
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
