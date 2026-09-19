import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { message, renderWithProviders } from './harness';

const route = vi.hoisted(() => ({ pathname: '/', search: '' }));

vi.mock('@/i18n/navigation', async () => {
  const { forwardRef } = await import('react');
  type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { href: string; locale?: string };
  const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, locale, children, ...rest }, ref) {
    return (
      <a ref={ref} href={href} data-locale={locale} {...rest}>
        {children}
      </a>
    );
  });
  return { Link, usePathname: () => route.pathname, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(route.search) }));

const { Navigation } = await import('@/components/navigation');

/** jsdom has no layout, so the indicator needs boxes handed to it to have anything to measure. */
function stubLayout(activeLabel: string | null) {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box =
      this.tagName === 'NAV'
        ? { x: 0, y: 0, width: 600, height: 40 }
        : this.textContent === activeLabel
          ? { x: 100, y: 10, width: 80, height: 20 }
          : { x: 0, y: 0, width: 0, height: 0 };
    return { ...box, top: box.y, left: box.x, right: box.x + box.width, bottom: box.y + box.height, toJSON: () => box } as DOMRect;
  });
}

function renderNav(pathname: string, search = '') {
  route.pathname = pathname;
  route.search = search;
  return renderWithProviders(
    <nav aria-label="main">
      <Navigation />
    </nav>,
  );
}

describe('Navigation', () => {
  it('renders every section plus the language toggle in the active locale', () => {
    renderNav('/');
    for (const key of ['about', 'projects', 'articles', 'contact']) {
      expect(screen.getByRole('link', { name: message('zh', `Site.${key}`) })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: message('zh', 'Site.language') })).toHaveTextContent(message('zh', 'Site.languageShort'));
  });

  it('marks only the current section with aria-current, matching nested routes by prefix', () => {
    renderNav('/projects/document-search');
    expect(screen.getByRole('link', { name: message('zh', 'Site.projects') })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: message('zh', 'Site.about') })).not.toHaveAttribute('aria-current');
  });

  it('treats home as current only on an exact match, never as a prefix of every route', () => {
    const { unmount } = renderNav('/');
    expect(screen.getByRole('link', { name: message('zh', 'Site.about') })).toHaveAttribute('aria-current', 'page');
    unmount();
    renderNav('/contact');
    expect(screen.getByRole('link', { name: message('zh', 'Site.about') })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: message('zh', 'Site.contact') })).toHaveAttribute('aria-current', 'page');
  });

  it('slides the indicator onto the current link and reports itself ready', async () => {
    stubLayout(message('zh', 'Site.projects'));
    const { container } = renderNav('/projects');
    const bar = container.querySelector<HTMLElement>('.nav-indicator');
    await waitFor(() => expect(bar).toHaveAttribute('data-ready', '1'));
    expect(bar?.style.width).toBe('80px');
    // 100 - 0 + 0 across, then the link's baseline: 10 + 20/2 + 14 * 0.85.
    expect(bar?.style.transform).toBe('translate(100px, 31.9px)');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to the CSS underline when no link matches the route', async () => {
    stubLayout(null);
    const { container } = renderNav('/does-not-exist');
    await waitFor(() => expect(container.querySelector('.nav-indicator')).not.toHaveAttribute('data-ready'));
  });

  it('points the language toggle at the other locale and carries the current filter across', () => {
    renderNav('/projects', 'tag=data-ai');
    const toggle = screen.getByRole('link', { name: message('zh', 'Site.language') });
    expect(toggle).toHaveAttribute('data-locale', 'en');
    expect(toggle).toHaveAttribute('href', '/projects?tag=data-ai');
    expect(toggle).toHaveAttribute('lang', 'en');
  });
});
