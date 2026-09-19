import type { Meta, StoryObj } from '@storybook/nextjs';
import type { SearchItem } from '@/lib/db/search';
import { CommandPalette } from './command-palette';

// A fixed index rather than the live one: a story never touches the database.
const items: SearchItem[] = [
  {
    type: 'project',
    slug: 'document-search',
    title_zh: '文件檢索系統',
    title_en: 'Document search',
    summary_zh: '以向量檢索處理內部文件，讓答案附上出處。',
    summary_en: 'Vector retrieval over internal documents, with citations attached to every answer.',
    tags: ['data-ai', 'web'],
  },
  {
    type: 'project',
    slug: 'file-cabinet',
    title_zh: '檔案管理系統',
    title_en: 'File cabinet',
    summary_zh: '把散落的檔案收進一套可搜尋的結構。',
    summary_en: 'Scattered files folded into one searchable structure.',
    tags: ['tool'],
  },
  {
    type: 'article',
    slug: 'typed-contracts',
    title_zh: '先定義契約，再處理錯誤',
    title_en: 'Contracts first, failures second',
    summary_zh: '輸入與輸出的型別先講清楚，錯誤處理才有依據。',
    summary_en: 'Pin down the input and output types, then the failure cases have something to hang on.',
    tags: ['engineering'],
  },
];

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Press Cmd/Ctrl+K anywhere, or use the trigger. Arrow keys move, Enter runs, Escape closes. ' +
          'Navigation and theme actions are wired to the real router and next-themes.',
      },
    },
  },
  args: { items, email: 'hello@example.com' },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** With no published address, the copy-email action is not offered at all. */
export const WithoutEmail: Story = { args: { email: null } };

/** Nothing indexed yet: only the pages and the actions remain. */
export const EmptyIndex: Story = { args: { items: [] } };

export const InAHeaderRow: Story = {
  parameters: { layout: 'padded' },
  render: args => (
    <div className="flex items-center justify-end gap-2 border-b border-rule pb-4">
      <CommandPalette {...args} />
    </div>
  ),
};
