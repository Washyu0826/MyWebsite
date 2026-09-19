import type { ReactElement, ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import zh from '../../messages/zh.json';
import en from '../../messages/en.json';

export const messages = { zh, en } as Record<'zh' | 'en', Record<string, unknown>>;
export type TestLocale = keyof typeof messages;

/** Mirrors src/components/providers.tsx so a component behaves here as it does in the app. */
export function renderWithProviders(ui: ReactElement, { locale = 'zh' as TestLocale, defaultTheme = 'dark' } = {}) {
  const user = userEvent.setup();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
        <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </NextIntlClientProvider>
    );
  }
  return { user, ...render(ui, { wrapper: Wrapper }) };
}

/** Reads a dotted message key, e.g. `Contact.form.errorName`, so assertions quote the real copy. */
export function message(locale: TestLocale, path: string): string {
  const value = path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages[locale]);
  if (typeof value !== 'string') throw new Error(`Missing message ${locale}.${path}`);
  return value;
}
