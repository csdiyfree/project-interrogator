// 简历上传相关的可复用片段:输入区(文本/PDF 二选一)、解析骨架、失败重试、共用图标。
// 由 UploadPage 与 InfoPage 复用。界面零提示文案:用图形、布局、动效与状态表达一切。

import type { ReactNode } from 'react';
import { Button, FileDrop, Skeleton, TextArea } from '../../design/components';

export type Mode = 'text' | 'pdf';

/* ── 输入区 ── */

export interface ComposeProps {
  mode: Mode;
  setMode: (m: Mode) => void;
  text: string;
  setText: (t: string) => void;
  file: File | null;
  setFile: (f: File) => void;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}

export function ComposeView({
  mode,
  setMode,
  text,
  setText,
  file,
  setFile,
  canSubmit,
  submitting,
  onSubmit,
}: ComposeProps) {
  return (
    <div className="mx-auto max-w-2xl animate-fade-up pt-4 sm:pt-10">
      <header className="mb-8 text-center sm:mb-10">
        <h1 className="font-serif text-[2rem] leading-tight text-ink sm:text-[2.6rem]">简历上传</h1>
        <p className="mt-2.5 text-sm text-ink-soft sm:text-[0.95rem]">
          让最挑剔的面试官,逐项拷问你的每个项目
        </p>
      </header>

      <div className="mb-5 flex justify-center">
        <div className="inline-flex gap-1 rounded-full border border-line bg-bg p-1">
          <ModeTab active={mode === 'text'} onClick={() => setMode('text')} label="文本">
            <TextLinesIcon />
          </ModeTab>
          <ModeTab active={mode === 'pdf'} onClick={() => setMode('pdf')} label="PDF">
            <DocIcon />
          </ModeTab>
        </div>
      </div>

      <div className="space-y-4">
        {mode === 'text' ? (
          <div className="relative">
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
              }}
              autoFocus
              className="min-h-[300px] text-[0.97rem]"
            />
            {text.trim() === '' && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 text-ink-soft">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/[0.04]">
                  <PasteIcon />
                </div>
                <span className="text-sm text-ink-soft/55">粘贴简历全文</span>
              </div>
            )}
          </div>
        ) : (
          <FileDrop file={file} onFile={setFile} hint="选择或拖入 PDF 简历" className="min-h-[300px]" />
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={!canSubmit}
            loading={submitting}
            onClick={onSubmit}
            aria-label="提交"
            className="!px-4"
          >
            {!submitting && <ArrowRightIcon />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-12 items-center justify-center rounded-full transition-all duration-200 ${
        active ? 'bg-surface text-accent shadow-soft' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/* ── 解析等待骨架 ── */

export function ParsingView() {
  return (
    <div className="animate-fade-in space-y-10">
      <div className="space-y-4">
        <Skeleton className="h-9 w-3/4 sm:h-11" />
        <div className="flex flex-wrap gap-2.5">
          {['w-28', 'w-36', 'w-32', 'w-24', 'w-28'].map((w, i) => (
            <Skeleton key={i} className={`h-8 rounded-full ${w}`} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-line bg-surface p-6 shadow-soft sm:p-7"
          >
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 失败重试 ── */

export function FailedView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-7 animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-[26px] border border-red/30 bg-red/[0.06] text-red/70">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M14 3v4a1 1 0 0 0 1 1h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 14.5l5-5M14.5 14.5l-5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <Button variant="primary" onClick={onRetry} aria-label="重试" className="!px-4">
        <RetryIcon />
      </Button>
    </div>
  );
}

/* ── 共用图标 ── */

export function ArrowRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M5 12h13M12 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextLinesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4.5h6M9 4.5a1.5 1.5 0 0 0-1.5 1.5M15 4.5A1.5 1.5 0 0 1 16.5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 6H6.5A1.5 1.5 0 0 0 5 7.5v11A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 6h-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.5 11.5h7M8.5 15h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M19.5 4v3.6h-3.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
