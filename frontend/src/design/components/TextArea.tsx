import { forwardRef, type TextareaHTMLAttributes } from 'react';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full resize-none rounded-md border border-line bg-surface px-4 py-3 text-ink leading-relaxed shadow-soft outline-none transition-all duration-200 placeholder:text-transparent focus:border-accent/50 focus:shadow-soft-lg focus:ring-4 focus:ring-accent/10 disabled:opacity-50 ${className}`}
        {...rest}
      />
    );
  },
);

TextArea.displayName = 'TextArea';
