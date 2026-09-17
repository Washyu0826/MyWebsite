import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeUrl } from '@/lib/urls';
export function Markdown({ children }: { children: string }) {
  return <div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href, children }) => <a href={safeUrl(href) ?? undefined} rel="noopener noreferrer">{children}</a>,
    img: ({ alt }) => <span>{alt}</span>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
  }}>{children}</ReactMarkdown></div>;
}
