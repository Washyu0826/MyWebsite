import type { Meta, StoryObj } from '@storybook/nextjs';
import { contactOutcome, type ContactState } from '../../../../.storybook/mocks/contact-actions';
import { ContactForm } from './contact-form';

/** The action is replaced in .storybook/main.ts, so nothing here reaches Supabase or Resend. */
function withOutcome(value: ContactState) {
  return [
    (Story: () => React.JSX.Element) => {
      contactOutcome.value = value;
      return <Story />;
    },
  ];
}

const meta = {
  title: 'Content/ContactForm',
  component: ContactForm,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Validates on blur and stops complaining as soon as a field is fixed. Drafts survive a reload in ' +
          'localStorage, and the honeypot plus the time-on-page floor are what keep bots out.',
      },
    },
  },
  args: { startedAt: String(Date.now()) },
  argTypes: { startedAt: { table: { disable: true } } },
  decorators: [
    Story => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Submit an empty form, or blur a field with something invalid in it, to see the inline errors. */
export const Default: Story = { decorators: withOutcome({ status: 'ok', emailed: true }) };

export const Delivered: Story = { decorators: withOutcome({ status: 'ok', emailed: true }) };

/** Stored in the database but not emailed, because no Resend key is configured. */
export const StoredOnly: Story = { decorators: withOutcome({ status: 'ok', emailed: false }) };

export const ServerRejectedFields: Story = {
  decorators: withOutcome({ status: 'error', code: 'invalid', fields: ['email', 'message'] }),
};

export const RateLimited: Story = { decorators: withOutcome({ status: 'error', code: 'rate' }) };

export const GenericFailure: Story = { decorators: withOutcome({ status: 'error', code: 'generic' }) };

/** A draft left behind by an earlier visit is read back on mount, with a notice. */
export const RestoredDraft: Story = {
  decorators: [
    ...withOutcome({ status: 'ok', emailed: true }),
    Story => {
      window.localStorage.setItem(
        'hsien-contact-draft',
        JSON.stringify({
          name: '冼冠宇',
          email: 'hello@example.com',
          message: '上次寫到一半的訊息。',
        }),
      );
      return <Story />;
    },
  ],
};
