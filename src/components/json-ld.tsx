import 'server-only';
import { isDemoMode } from '@/lib/db/config';
import { graph, type JsonLdNode } from '@/lib/structured-data';

export function JsonLd({ nodes }: { nodes: (JsonLdNode | null | undefined)[] }) {
  // Demo deployments are noindex; publishing structured data about sample content would be a lie.
  if (isDemoMode()) return null;
  const data = graph(nodes);
  if (!data) return null;
  return <script type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
