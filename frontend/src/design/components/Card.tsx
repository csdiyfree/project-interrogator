import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive = false, className = '', children, ...rest }: CardProps) {
  const interactiveCls = interactive
    ? 'cursor-pointer transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-1 active:translate-y-0'
    : '';
  return (
    <div
      className={`rounded-lg border border-line bg-surface shadow-soft ${interactiveCls} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
