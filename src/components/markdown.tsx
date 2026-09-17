import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from '@/i18n/navigation';
import { classifyHref } from '@/lib/urls';
function MarkdownLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const link = classifyHref(href);
  if (link.kind === 'external') return <a href={link.href} target="_blank" rel="noopener noreferrer">{children}</a>;
  if (link.kind === 'internal') return <Link href={link.href}>{children}</Link>;
  if (link.kind === 'anchor') return <a href={link.href}>{children}</a>;
  return <a>{children}</a>;
}
export function Markdown({ children }: { children: string }) {
  return <div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
    img: ({ alt }) => <span>{alt}</span>,
    table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
  }}>{children}</ReactMarkdown></div>;
}
