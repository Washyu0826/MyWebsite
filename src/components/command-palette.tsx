'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  ArrowRight, Copy, CornerDownLeft, Download, FileText, FolderGit2, Languages,
  Mail, Monitor, Moon, type LucideIcon, Search, Sun, User,
} from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { rankItems } from '@/lib/search-match';
import type { SearchItem } from '@/lib/db/search';
import { cn } from '@/lib/utils';

type Group = 'pages' | 'projects' | 'articles' | 'actions';
type Command = {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  keywords: string[];
  Icon: LucideIcon;
  run: () => void | Promise<void>;
  /** Keeps the dialog open so the user can see the result, e.g. after copying. */
  keepOpen?: boolean;
};

const groupOrder: Group[] = ['pages', 'projects', 'articles', 'actions'];

export function CommandPalette({ items, email }: { items: SearchItem[]; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const t = useTranslations('Command');
  const site = useTranslations('Site');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // Global shortcut. Ignored while typing somewhere else so it never eats real input.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(current => !current);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setCopied(false); }
  }, [open]);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);

  const commands = useMemo<Command[]>(() => {
    const localised = (item: SearchItem) => ({
      title: (locale === 'en' ? item.title_en : item.title_zh) || item.title_zh || item.title_en,
      summary: (locale === 'en' ? item.summary_en : item.summary_zh) || '',
    });

    const pages: Command[] = [
      { id: 'page-about', group: 'pages', label: site('about'), keywords: ['about', 'home', '關於', '首頁'], Icon: User, run: () => go('/') },
      { id: 'page-projects', group: 'pages', label: site('projects'), keywords: ['projects', 'work', '作品', '專案'], Icon: FolderGit2, run: () => go('/projects') },
      { id: 'page-articles', group: 'pages', label: site('articles'), keywords: ['articles', 'notes', 'blog', '文章'], Icon: FileText, run: () => go('/articles') },
      { id: 'page-contact', group: 'pages', label: site('contact'), keywords: ['contact', 'email', '聯絡'], Icon: Mail, run: () => go('/contact') },
    ];

    const content: Command[] = items.map(item => {
      const { title, summary } = localised(item);
      return {
        id: `${item.type}-${item.slug}`,
        group: item.type === 'project' ? 'projects' : 'articles',
        label: title,
        hint: summary,
        keywords: [item.slug, ...item.tags, item.title_zh, item.title_en, item.summary_zh, item.summary_en],
        Icon: item.type === 'project' ? FolderGit2 : FileText,
        run: () => go(`/${item.type === 'project' ? 'projects' : 'articles'}/${item.slug}`),
      };
    });

    const actions: Command[] = [
      { id: 'action-language', group: 'actions', label: t('language'), keywords: ['language', 'locale', '語言', '中文', 'english'], Icon: Languages,
        run: () => { setOpen(false); router.replace(pathname, { locale: locale === 'zh' ? 'en' : 'zh' }); } },
      { id: 'action-theme-light', group: 'actions', label: t('themeLight'), keywords: ['theme', 'light', '主題', '淺色'], Icon: Sun, run: () => { setTheme('light'); setOpen(false); } },
      { id: 'action-theme-dark', group: 'actions', label: t('themeDark'), keywords: ['theme', 'dark', '主題', '深色'], Icon: Moon, run: () => { setTheme('dark'); setOpen(false); } },
      { id: 'action-theme-system', group: 'actions', label: t('themeSystem'), keywords: ['theme', 'system', '主題', '系統'], Icon: Monitor, run: () => { setTheme('system'); setOpen(false); } },
      { id: 'action-resume', group: 'actions', label: t('resume'), keywords: ['resume', 'cv', 'pdf', '履歷'], Icon: Download,
        run: () => { setOpen(false); window.location.href = `/resume/${locale}.pdf`; } },
    ];
    if (email) {
      actions.push({
        id: 'action-copy-email', group: 'actions', label: t('copyEmail'), hint: email,
        keywords: ['email', 'copy', 'mail', '信箱', '複製'], Icon: Copy, keepOpen: true,
        run: async () => { try { await navigator.clipboard.writeText(email); setCopied(true); } catch { setCopied(false); } },
      });
    }

    return [...pages, ...content, ...actions];
  }, [items, email, locale, pathname, router, setTheme, go, t, site]);

  const results = useMemo(
    () => rankItems(query, commands, command => [command.label, command.hint, ...command.keywords]),
    [query, commands],
  );

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results.length]);

  const grouped = useMemo(
    () => groupOrder
      .map(group => ({ group, entries: results.filter(command => command.group === group) }))
      .filter(section => section.entries.length > 0),
    [results],
  );

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => (index + 1) % results.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index - 1 + results.length) % results.length); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(results.length - 1); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[active];
      if (!command) return;
      if (!command.keepOpen) setCopied(false);
      void command.run();
    }
  }

  const activeCommand = results[active];

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild>
      <button type="button" className="command-trigger" aria-label={t('open')}>
        <Search size={16} aria-hidden="true" />
        <span className="command-trigger-label">{t('search')}</span>
        <kbd className="command-kbd" aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="command-overlay" />
      <Dialog.Content className="command-panel" aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); (event.currentTarget as HTMLElement).querySelector('input')?.focus(); }}>
        <Dialog.Title className="sr-only">{t('title')}</Dialog.Title>
        <div className="command-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            className="command-input" type="text" autoComplete="off" spellCheck={false}
            placeholder={t('placeholder')} value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            role="combobox" aria-expanded aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={activeCommand ? `${listId}-${activeCommand.id}` : undefined}
            aria-label={t('placeholder')}
          />
        </div>

        <div className="command-results" ref={listRef} id={listId} role="listbox" aria-label={t('title')}>
          {results.length === 0
            ? <p className="command-empty">{t('empty')}</p>
            : grouped.map(section => <div key={section.group} className="command-group">
              <p className="command-group-label" aria-hidden="true">{t(section.group)}</p>
              {section.entries.map(command => {
                const index = results.indexOf(command);
                const isActive = index === active;
                const { Icon } = command;
                return <div
                  key={command.id} id={`${listId}-${command.id}`} role="option" aria-selected={isActive}
                  data-active={isActive} className={cn('command-item', isActive && 'command-item-active')}
                  onMouseMove={() => setActive(index)}
                  onClick={() => { if (!command.keepOpen) setCopied(false); void command.run(); }}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="command-item-label">{command.label}</span>
                  {command.hint && <span className="command-item-hint">{command.hint}</span>}
                  <ArrowRight size={14} aria-hidden="true" className="command-item-go" />
                </div>;
              })}
            </div>)}
        </div>

        <div className="command-footer">
          <span><kbd className="command-kbd">↑</kbd><kbd className="command-kbd">↓</kbd> {t('hintMove')}</span>
          <span><kbd className="command-kbd"><CornerDownLeft size={11} aria-hidden="true" /></kbd> {t('hintSelect')}</span>
          <span><kbd className="command-kbd">Esc</kbd> {t('hintClose')}</span>
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? t('copied') : results.length > 0 ? t('resultCount', { count: results.length }) : t('empty')}
        </span>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
