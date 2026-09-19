import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ThemeSwitch } from '@/components/theme-switch';
import { message, renderWithProviders } from './harness';

const label = message('zh', 'Site.theme');

describe('ThemeSwitch', () => {
  it('starts on dark so the icon does not jump after hydration', async () => {
    renderWithProviders(<ThemeSwitch />);
    const select = await screen.findByRole('combobox', { name: label });
    await waitFor(() => expect(select).toHaveValue('dark'));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('writes the chosen theme onto <html> and persists it', async () => {
    const { user } = renderWithProviders(<ThemeSwitch />);
    const select = await screen.findByRole('combobox', { name: label });
    await user.selectOptions(select, 'light');
    await waitFor(() => expect(document.documentElement).toHaveClass('light'));
    expect(select).toHaveValue('light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('offers system, light and dark using the active locale copy', async () => {
    renderWithProviders(<ThemeSwitch />, { locale: 'en' });
    const select = await screen.findByRole('combobox', { name: message('en', 'Site.theme') });
    expect([...select.querySelectorAll('option')].map(option => option.value)).toEqual(['system', 'light', 'dark']);
    expect(screen.getByRole('option', { name: message('en', 'Site.system') })).toHaveValue('system');
  });

  it('keeps the select on top of the icon so the icon is never the accessible name', async () => {
    renderWithProviders(<ThemeSwitch />);
    const select = await screen.findByRole('combobox', { name: label });
    expect(select.className).toContain('opacity-0');
    expect(select.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
