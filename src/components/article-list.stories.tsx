import type { Meta, StoryObj } from '@storybook/nextjs';
import type { Post } from '@/types/content';
import { Rsc } from '../../.storybook/rsc';
import { ArticleList } from './article-list';

const timestamp = '2026-09-01T00:00:00Z';
// Fixed sample copy so the story is stable and never needs a database.
const posts: Post[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    slug: 'typed-contracts',
    title_zh: '先定義契約，再處理錯誤',
    title_en: 'Contracts first, failures second',
    excerpt_zh: '把輸入與輸出的型別講清楚之後，錯誤處理才有依據，重構也才有安全網。',
    excerpt_en: 'Once the input and output types are pinned down, error handling has something to hang on.',
    body_zh: null,
    body_en: null,
    cover_url: '/demo/architecture.svg',
    cover_alt_zh: '輸入經驗證後寫入儲存層的示意圖',
    cover_alt_en: 'Validated input flowing through to storage',
    tags: ['engineering', 'typescript'],
    reading_minutes: 8,
    status: 'published',
    published_at: '2026-08-12T00:00:00Z',
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    slug: 'reading-a-slow-query',
    title_zh: '讀懂一個慢查詢',
    title_en: 'Reading a slow query',
    excerpt_zh: '從執行計畫開始，而不是從索引開始。',
    excerpt_en: 'Start at the execution plan, not at the index.',
    body_zh: null,
    body_en: null,
    cover_url: null,
    cover_alt_zh: null,
    cover_alt_en: null,
    tags: ['data'],
    reading_minutes: 5,
    status: 'published',
    published_at: '2026-06-30T00:00:00Z',
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    slug: 'notes-on-motion',
    title_zh: '關於動態的幾則筆記',
    title_en: 'Notes on motion',
    excerpt_zh: null,
    excerpt_en: null,
    body_zh: null,
    body_en: null,
    cover_url: null,
    cover_alt_zh: null,
    cover_alt_en: null,
    tags: [],
    reading_minutes: null,
    status: 'published',
    published_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  },
];

const meta = {
  title: 'Content/ArticleList',
  component: ArticleList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Dates are formatted in the row locale; a post with no date, tags or excerpt still has to sit level with the rest.',
      },
    },
  },
  args: { posts, locale: 'zh' },
  argTypes: { locale: { control: 'inline-radio', options: ['zh', 'en'] } },
  render: args => <Rsc component={ArticleList} props={args} />,
} satisfies Meta<typeof ArticleList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chinese: Story = {};

export const English: Story = { args: { locale: 'en' } };

/** The third entry is the sparse case: no excerpt, no tags, no date and no reading time. */
export const SparseEntry: Story = { args: { posts: posts.slice(2) } };

export const SingleRow: Story = { args: { posts: posts.slice(0, 1) } };
