import type { Meta, StoryObj } from '@storybook/nextjs';
import { Rsc } from '../../.storybook/rsc';
import { demoProjects } from '@/lib/demo/projects';
import { ProjectList } from './project-list';

const meta = {
  title: 'Content/ProjectList',
  component: ProjectList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Reads from the demo catalogue, never the database. Hovering a row previews its cover next to the cursor.',
      },
    },
  },
  args: { projects: demoProjects, locale: 'zh', headingLevel: 2 },
  argTypes: {
    locale: { control: 'inline-radio', options: ['zh', 'en'] },
    headingLevel: { control: 'inline-radio', options: [2, 3] },
  },
  render: args => <Rsc component={ProjectList} props={args} />,
} satisfies Meta<typeof ProjectList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chinese: Story = {};

export const English: Story = { args: { locale: 'en' } };

/** Featured rows on the home page sit under an h2, so they drop to h3. */
export const AsSubsection: Story = { args: { headingLevel: 3, projects: demoProjects.slice(0, 2) } };

/** A project with no cover still has to line up with the ones that have. */
export const WithoutCovers: Story = {
  args: { projects: demoProjects.slice(0, 2).map(project => ({ ...project, cover_url: null })) },
};

export const SingleRow: Story = { args: { projects: demoProjects.slice(0, 1) } };
