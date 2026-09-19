import type { Meta, StoryObj } from '@storybook/nextjs';
import { ThemeSwitch } from './theme-switch';

const meta = {
  title: 'Components/ThemeSwitch',
  component: ThemeSwitch,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'The icon is decorative; the invisible <select> on top of it carries the label and the keyboard behaviour.',
      },
    },
  },
} satisfies Meta<typeof ThemeSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Focus reveals the select, which is how a keyboard user sees what they are about to change. */
export const Focused: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <ThemeSwitch />
      <p className="text-meta text-graphite">Tab to the control to reveal the native select.</p>
    </div>
  ),
};

export const InAHeaderRow: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex items-center justify-end gap-2 border-b border-rule pb-4">
      <span className="text-meta text-graphite">冼冠宇</span>
      <ThemeSwitch />
    </div>
  ),
};
