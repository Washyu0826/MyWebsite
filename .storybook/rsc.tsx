import { Suspense, use, useMemo, type ReactNode } from 'react';

function Resolved({ node }: { node: Promise<ReactNode> }) {
  return <>{use(node)}</>;
}

/**
 * ProjectList and ArticleList are async Server Components. Storybook renders in a browser, where an
 * async component cannot be mounted directly, so this calls it as the plain function it is and hands
 * the promise to `use()`. Everything request-scoped inside it is aliased in .storybook/main.ts.
 */
export function Rsc<P extends object>({ component, props }: { component: (props: P) => Promise<ReactNode>; props: P }) {
  const node = useMemo(() => component(props), [component, props]);
  return (
    <Suspense fallback={null}>
      <Resolved node={node} />
    </Suspense>
  );
}
