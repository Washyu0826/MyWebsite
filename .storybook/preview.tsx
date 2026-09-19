import type { Decorator, Preview } from '@storybook/nextjs';
import { withThemeByClassName } from '@storybook/addon-themes';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import en from '../messages/en.json';
import zh from '../messages/zh.json';
import { storybookLocale } from './mocks/next-intl-server';
import '../src/app/globals.css';

const messages = { zh, en } as Record<string, Record<string, unknown>>;

/** Mirrors src/components/providers.tsx, plus the locale the toolbar is pointing at. */
const withIntl: Decorator = (Story, context) => {
  const locale = (context.globals.locale as 'zh' | 'en') ?? 'zh';
  // The mocked next-intl/server reads this, so the async list components follow the toolbar too.
  storybookLocale.value = locale;
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
        <div lang={locale === 'zh' ? 'zh-TW' : 'en'} className="story-frame">
          <Story />
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
};

const preview: Preview = {
  parameters: {
    // Gives next/navigation, next/link and next/image the App Router context they expect.
    nextjs: { appDirectory: true },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // The site paints its own background from the theme token; Storybook's picker would fight it.
    backgrounds: { disable: true },
  },
  globalTypes: {
    locale: {
      description: 'Site language',
      toolbar: {
        icon: 'globe',
        dynamicTitle: true,
        items: [
          { value: 'zh', title: '中文' },
          { value: 'en', title: 'English' },
        ],
      },
    },
  },
  initialGlobals: { locale: 'zh' },
  decorators: [
    withIntl,
    // next-themes writes the class itself, but the toolbar has to be able to override it.
    withThemeByClassName({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'dark', parentSelector: 'html' }),
  ],
};

export default preview;
