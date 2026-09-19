import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { SearchItem } from '@/lib/db/search';
import { message, renderWithProviders } from './harness';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ usePathname: () => '/projects', useRouter: () => router }));

const { CommandPalette } = await import('@/components/command-palette');

const items: SearchItem[] = [
  {
    type: 'project',
    slug: 'document-search',
    title_zh: '文件搜尋',
    title_en: 'Document search',
    summary_zh: '以向量檢索處理內部文件',
    summary_en: 'Vector retrieval over internal documents',
    tags: ['data-ai'],
  },
  {
    type: 'article',
    slug: 'typed-contracts',
    title_zh: '型別契約',
    title_en: 'Typed contracts',
    summary_zh: '先定義契約',
    summary_en: 'Contracts first',
    tags: ['engineering'],
  },
];

const t = (key: string) => message('zh', 'Command.' + key);

function renderPalette(email: string | null = 'hello@example.com') {
  return renderWithProviders(<CommandPalette items={items} email={email} />);
}

type User = ReturnType<typeof renderPalette>['user'];

async function openPalette(user: User) {
  await user.keyboard('{Control>}k{/Control}');
  return screen.findByRole('dialog');
}

describe('CommandPalette', () => {
  it('opens on Ctrl+K, closes on a second press and focuses the input', async () => {
    const { user } = renderPalette();
    expect(screen.queryByRole('dialog')).toBeNull();
    const dialog = await openPalette(user);
    await waitFor(() => expect(within(dialog).getByRole('combobox')).toHaveFocus());
    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes on Escape', async () => {
    const { user } = renderPalette();
    await openPalette(user);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('also opens from its visible trigger button', async () => {
    const { user } = renderPalette();
    await user.click(screen.getByRole('button', { name: t('open') }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('filters by title, summary and tag, and reports the count in a live region', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), 'document');
    await waitFor(() => expect(within(dialog).getAllByRole('option')).toHaveLength(1));
    expect(within(dialog).getByRole('option')).toHaveTextContent('文件搜尋');
    expect(within(dialog).getByRole('status')).toHaveTextContent('1');
  });

  it('shows the empty state rather than an empty list when nothing matches', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), 'zzzzzz');
    await waitFor(() => expect(within(dialog).queryAllByRole('option')).toHaveLength(0));
    // Once on screen, once in the live region.
    expect(within(dialog).getAllByText(t('empty'))).toHaveLength(2);
  });

  it('moves the active option with the arrow keys and wraps at both ends', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    const input = within(dialog).getByRole('combobox');
    const optionIds = () =>
      within(dialog)
        .getAllByRole('option')
        .map(option => option.id);
    const first = optionIds()[0];
    expect(input).toHaveAttribute('aria-activedescendant', first);
    await user.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).not.toBe(first);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', first);
    // Up from the first entry wraps round to the last.
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', optionIds().at(-1));
    await user.keyboard('{Home}');
    expect(input).toHaveAttribute('aria-activedescendant', first);
    await user.keyboard('{End}');
    expect(input).toHaveAttribute('aria-activedescendant', optionIds().at(-1));
  });

  it('navigates to the highlighted result on Enter and closes', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), 'document');
    await waitFor(() => expect(within(dialog).getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{Enter}');
    expect(router.push).toHaveBeenCalledWith('/projects/document-search');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('switches the locale through the language action without leaving the route', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), t('language'));
    await user.keyboard('{Enter}');
    expect(router.replace).toHaveBeenCalledWith('/projects', { locale: 'en' });
  });

  it('applies a theme action to <html> and closes', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), t('themeLight'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
  });

  it('keeps itself open after copying the email so the confirmation is visible', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.type(within(dialog).getByRole('combobox'), t('copyEmail'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('hello@example.com'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('status')).toHaveTextContent(t('copied')));
  });

  it('omits the copy action entirely when no address is published', async () => {
    const { user } = renderPalette(null);
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), t('copyEmail'));
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
  });

  it('resets the query each time it reopens', async () => {
    const { user } = renderPalette();
    const dialog = await openPalette(user);
    await user.type(within(dialog).getByRole('combobox'), 'document');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const reopened = await openPalette(user);
    expect(within(reopened).getByRole('combobox')).toHaveValue('');
  });
});
