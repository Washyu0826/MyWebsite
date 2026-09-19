import type { Meta, StoryObj } from '@storybook/nextjs';
import { CopyValue } from './copy-email';

const meta = {
  title: 'Components/CopyValue',
  component: CopyValue,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Click to copy. The tick is redrawn on every repeat copy, and the confirmation is announced in a live region.',
      },
    },
  },
  args: { value: 'hello@example.com', label: '複製 Email' },
} satisfies Meta<typeof CopyValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomConfirmation: Story = { args: { label: 'Copy address', copiedLabel: 'Copied to clipboard' } };

/** Clipboard access is denied in some embedded contexts; the component falls back to a visible instruction. */
export const ClipboardUnavailable: Story = {
  args: { label: '複製 Email' },
  decorators: [
    Story => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('Clipboard blocked in this frame.')) },
      });
      return <Story />;
    },
  ],
};
