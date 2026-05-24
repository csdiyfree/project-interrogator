import { useRef, useState, type DragEvent, type ReactNode } from 'react';

interface FileDropProps {
  /** 选中的文件(受控);由父组件持有。 */
  file?: File | null;
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  /** 未选中文件时,图标下方的提示(文案由调用方注入,组件本身不含文案)。 */
  hint?: ReactNode;
}

/**
 * 拖拽 / 点击选择文件。用图形与状态表达(图标变化、拖拽高亮、选中态);
 * 文案经 hint 注入,组件本身不内置文案。文件名属于用户内容,可显示。
 */
export function FileDrop({
  file,
  onFile,
  accept = 'application/pdf',
  disabled = false,
  className = '',
  hint,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const selected = !!file;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`group relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed bg-surface/60 px-6 py-10 text-center transition-all duration-200 ${
        dragging
          ? 'border-accent bg-accent/[0.04] scale-[1.01]'
          : selected
            ? 'border-accent/40'
            : 'border-line hover:border-accent/40 hover:bg-surface'
      } ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      <UploadIcon active={dragging || selected} />

      {selected ? (
        <div className="max-w-full animate-fade-in truncate text-sm text-ink-soft">
          {file!.name}
        </div>
      ) : hint != null ? (
        <div className="animate-fade-in text-sm text-ink-soft/55">{hint}</div>
      ) : null}
    </div>
  );
}

function UploadIcon({ active }: { active: boolean }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
        active ? 'bg-accent/10 text-accent' : 'bg-ink/[0.04] text-ink-soft group-hover:text-accent'
      }`}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 15V4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 8l4-4 4 4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={active ? '-translate-y-0.5 transition-transform duration-300' : 'transition-transform duration-300'}
        />
        <path
          d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
