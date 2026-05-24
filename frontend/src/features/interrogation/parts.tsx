// 拷问页的纯展示原子:面试官徽标、对话气泡、书写光标、思考点与图标。
// 全部无文案,以图形 / 动效表达状态。

import type { ReactNode } from 'react';

/** 面试官徽标:暖陶土方印 + 内嵌问探弧(与全局 BrandMark 同源,缩小克制)。 */
export function InterviewerMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center shadow-soft"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: 'linear-gradient(135deg, var(--accent), #a8552f)',
      }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.4" />
        <path
          d="M9.5 9.7c0-1.6 1.2-2.6 2.6-2.6s2.6 1 2.6 2.5c0 1.9-2.2 2-2.5 3.6"
          stroke="#fff"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="11.95" cy="16.1" r="1.05" fill="#fff" />
      </svg>
    </span>
  );
}

/** 打字机闪烁光标。 */
export function Caret() {
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-blink rounded-full bg-accent align-baseline"
      aria-hidden
    />
  );
}

/** 面试官「酝酿中」的三点呼吸,无文字。 */
export function TypingDots() {
  return (
    <span className="flex items-center gap-1.5 py-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-breathe rounded-full bg-accent/60"
          style={{ animationDelay: `${i * 0.16}s`, animationDuration: '1.2s' }}
        />
      ))}
    </span>
  );
}

/** 面试官气泡(问题 / 收尾语)。tone='closing' 用克制冷绿表达终局。 */
export function QuestionBubble({
  tone = 'question',
  children,
}: {
  tone?: 'question' | 'closing';
  children: ReactNode;
}) {
  const closing = tone === 'closing';
  return (
    <div className="flex items-start gap-3 animate-fade-up">
      <InterviewerMark />
      <div
        className={`max-w-[88%] whitespace-pre-wrap rounded-lg rounded-tl-sm border px-5 py-3.5 leading-relaxed text-ink shadow-soft ${
          closing ? 'border-accent-2/30 bg-accent-2/[0.08]' : 'border-line bg-surface'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** 用户回答气泡,右对齐、暖色微染。 */
export function AnswerBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end animate-fade-up">
      <div className="max-w-[82%] whitespace-pre-wrap rounded-lg rounded-tr-sm border border-accent/20 bg-accent/[0.09] px-5 py-3.5 leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

/* ── 图标 ── */
export function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19V6M6 12l6-6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h13M12 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RetryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M21 4v5h-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 手稿标题图标:带文本行的文稿。 */
export function ManuscriptIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 12.5h5M9.5 15.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 折叠开关的指向箭头(默认指向右,通过 className 旋转表达状态)。 */
export function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`transition-transform duration-200 ${className}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
