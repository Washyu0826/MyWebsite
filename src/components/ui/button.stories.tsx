import type { Meta, StoryObj } from '@storybook/nextjs';
import { ArrowRight, Download } from 'lucide-react';
import { Button } from './button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'outline', 'ghost'] },
    asChild: { table: { disable: true } },
  },
  args: { children: '送出訊息', variant: 'default', disabled: false },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: 'outline', children: '複製 Email' } };

export const Ghost: Story = { args: { variant: 'ghost', children: '返回作品集' } };

export const Disabled: Story = { args: { disabled: true } };

export const WithIcon: Story = {
  args: {
    variant: 'outline',
    children: (
      <>
        <Download size={16} aria-hidden="true" />
        下載履歷 PDF
      </>
    ),
  },
};

/** The hover fill is painted by interactions.css off data-variant, so every variant is worth seeing together. */
export const AllVariants: Story = {
  parameters: { layout: 'padded' },
  render: args => (
    <div className="flex flex-wrap items-center gap-4">
      <Button {...args} variant="default">
        主要動作
      </Button>
      <Button {...args} variant="outline">
        次要動作
      </Button>
      <Button {...args} variant="ghost">
        文字動作
      </Button>
      <Button {...args} variant="outline" disabled>
        停用
      </Button>
    </div>
  ),
};

/** asChild hands the styling to whatever element is passed, so a link never becomes a nested button. */
export const AsLink: Story = {
  args: {
    asChild: true,
    variant: 'outline',
    children: (
      <a href="#projects">
        看看作品
        <ArrowRight size={16} aria-hidden="true" />
      </a>
    ),
  },
};
