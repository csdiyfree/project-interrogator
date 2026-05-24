import type { HTMLAttributes, ReactNode } from 'react';

interface ChipProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  children: ReactNode;
}

/** 摘要 item 等小标签。可选 label 作为前缀,以低饱和暖灰呈现。 */
export function Chip({ label, children, className = '', ...rest }: ChipProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3.5 py-1.5 text-sm ${className}`}
      {...rest}
    >
      {label != null && <span className="text-ink-soft">{label}</span>}
      <span className="text-ink">{children}</span>
    </div>
  );
}
