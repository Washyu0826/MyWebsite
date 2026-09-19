import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { CopyValue } from '@/components/copy-email';
import { message, renderWithProviders } from './harness';

const copied = message('zh', 'Contact.copied');
const failed = message('zh', 'Contact.copyFailed');

/** userEvent.setup() installs its own clipboard stub, so this has to land after the render. */
function stubClipboard(writeText: () => Promise<void>) {
  const spy = vi.fn(writeText);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true });
  return spy;
}

describe('CopyValue', () => {
  it('writes the value to the clipboard and announces the confirmation in a live region', async () => {
    const { user } = renderWithProviders(<CopyValue value="hello@example.com" label="複製 Email" />);
    const writeText = stubClipboard(() => Promise.resolve());
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');
    await user.click(screen.getByRole('button', { name: /複製 Email/ }));
    expect(writeText).toHaveBeenCalledWith('hello@example.com');
    await waitFor(() => expect(status).toHaveTextContent(copied));
  });

  it('returns to idle after the confirmation window instead of latching on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { user } = renderWithProviders(<CopyValue value="a@b.c" label="Copy" />);
      stubClipboard(() => Promise.resolve());
      await user.click(screen.getByRole('button', { name: /Copy/ }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(copied));
      await vi.advanceTimersByTimeAsync(2000);
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''));
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces a visible fallback instruction when the clipboard is blocked', async () => {
    const { user } = renderWithProviders(<CopyValue value="a@b.c" label="Copy" />);
    stubClipboard(() => Promise.reject(new Error('denied')));
    await user.click(screen.getByRole('button', { name: /Copy/ }));
    const status = await screen.findByRole('status');
    await waitFor(() => expect(status).toHaveTextContent(failed));
    expect(status).not.toHaveClass('sr-only');
  });

  it('honours a caller-supplied confirmation label', async () => {
    const { user } = renderWithProviders(<CopyValue value="a@b.c" label="Copy" copiedLabel="Saved" />);
    stubClipboard(() => Promise.resolve());
    await user.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'));
  });

  it('is reachable and operable from the keyboard alone', async () => {
    const { user } = renderWithProviders(<CopyValue value="a@b.c" label="Copy" />);
    const writeText = stubClipboard(() => Promise.resolve());
    await user.tab();
    expect(screen.getByRole('button', { name: /Copy/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  });
});
