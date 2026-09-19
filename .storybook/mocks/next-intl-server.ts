// `getTranslations` is request-scoped on the server. In the browser there is no request, so this
// reads the same message catalogues directly and follows the locale picked in the toolbar.
import { createTranslator } from 'next-intl';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';

const messages = { zh, en } as Record<string, Record<string, unknown>>;
export const storybookLocale: { value: 'zh' | 'en' } = { value: 'zh' };

type Options = string | { locale?: string; namespace?: string };

export async function getTranslations(options?: Options) {
  const { locale = storybookLocale.value, namespace } = typeof options === 'string' ? { namespace: options } : (options ?? {});
  return createTranslator({ locale, namespace, messages: messages[locale] ?? messages.zh, timeZone: 'UTC' });
}

export async function getLocale() {
  return storybookLocale.value;
}
export async function getMessages() {
  return messages[storybookLocale.value];
}
export async function getFormatter() {
  return { dateTime: (value: Date) => value.toISOString() };
}
export function setRequestLocale(locale: string) {
  storybookLocale.value = locale === 'en' ? 'en' : 'zh';
}
