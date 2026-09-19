import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { renderWithProviders } from './harness';

describe('Button', () => {
  it('renders a real button, defaults to the solid variant and keeps the 44px hit target', () => {
    renderWithProviders(<Button>Send</Button>);
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('data-variant', 'default');
    expect(button).toHaveAttribute('data-slot', 'button');
    expect(button.className).toContain('min-h-11');
  });

  it('exposes the chosen variant to interactions.css through data-variant', () => {
    renderWithProviders(<Button variant="outline">Copy</Button>);
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveAttribute('data-variant', 'outline');
  });

  it('asChild hands the styling to the child element instead of nesting a button', () => {
    renderWithProviders(
      <Button asChild variant="ghost">
        <a href="/projects">Projects</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Projects' });
    expect(link).toHaveAttribute('data-variant', 'ghost');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not fire while disabled', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <Button disabled onClick={onClick}>
        Send
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('activates from the keyboard once focused', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(<Button onClick={onClick}>Send</Button>);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
