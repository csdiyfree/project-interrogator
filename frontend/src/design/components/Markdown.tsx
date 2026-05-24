import ReactMarkdown from 'react-markdown';

interface MarkdownProps {
  children: string;
  className?: string;
}

/** 套用 .md 排版样式(定义于 index.css)的 react-markdown 包装。手稿与指南共用。 */
export function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
