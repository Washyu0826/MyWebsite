import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { diffSnapshots } from '@/lib/diff';
import type { RevisionSummary } from '@/lib/revisions';

// The real actions reach for Supabase through next/cache and server-only. The diff they return is
// computed by the same pure function the server uses, so what the component renders here is what it
// renders in the app; only the transport is replaced.
const server = vi.hoisted(() => ({
  diffCalls: [] as { id: string; revision: number }[],
  restoreCalls: [] as FormData[],
  snapshots: {} as Record<number, Record<string, unknown>>,
  current: {} as Record<string, unknown>,
  diffFails: false,
  restoreReply: { ok: true, message: '已還原第 1 版，文章已轉為草稿，確認後再發布。' },
}));

vi.mock('../../src/app/admin/articles/actions', () => ({
  async diffRevisionAction(_previous: unknown, formData: FormData) {
    const revision = Number(formData.get('revision'));
    server.diffCalls.push({ id: String(formData.get('id')), revision });
    if (server.diffFails) return { ok: false, message: '找不到這個修訂版本。' };
    const fields = diffSnapshots(server.snapshots[revision] || {}, server.current);
    return fields.length ? { ok: true, message: '', fields } : { ok: true, message: '這個版本與目前內容相同。', fields: [] };
  },
  async restoreRevisionAction(_previous: unknown, formData: FormData) {
    server.restoreCalls.push(formData);
    return server.restoreReply;
  },
}));

const { ArticleRevisions } = await import('@/app/admin/articles/article-revisions');

const postId = '11111111-1111-4111-8111-111111111111';
const revisions: RevisionSummary[] = [
  { id: 'r2', revision: 2, reason: 'save', created_at: '2026-09-20T02:00:00Z', changed: ['內文（中文）', '標籤'] },
  { id: 'r1', revision: 1, reason: 'save', created_at: '2026-09-20T01:00:00Z', changed: [] },
];

function setup(rows: RevisionSummary[] = revisions) {
  server.diffCalls = [];
  server.restoreCalls = [];
  server.diffFails = false;
  server.snapshots = { 1: { body_zh: '第一行\n第二行', tags: ['a'] }, 2: { body_zh: '第一行\n改過的第二行', tags: ['a'] } };
  server.current = { body_zh: '第一行\n改過的第二行', tags: ['a', 'b'] };
  return { user: userEvent.setup(), ...render(<ArticleRevisions postId={postId} revisions={rows} />) };
}

describe('ArticleRevisions', () => {
  it('explains that history starts at the next save when there is none yet', () => {
    setup([]);
    expect(screen.getByText(/還沒有修訂紀錄/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /還原此版/ })).not.toBeInTheDocument();
  });

  it('lists each revision with what it changed, newest first', () => {
    setup();
    const entries = screen.getAllByRole('listitem');
    expect(within(entries[0]).getByText('第 2 版')).toBeInTheDocument();
    expect(within(entries[0]).getByText(/變更：內文（中文）、標籤/)).toBeInTheDocument();
    expect(within(entries[1]).getByText(/目前保留的最早版本/)).toBeInTheDocument();
  });

  it('shows the difference against the current article, with both line numbers', async () => {
    const { user } = setup();
    await user.click(screen.getAllByRole('button', { name: /與目前比較/ })[1]);
    await waitFor(() => expect(screen.getByLabelText('內文（中文） 的差異')).toBeInTheDocument());
    expect(server.diffCalls).toEqual([{ id: postId, revision: 1 }]);

    const body = screen.getByLabelText('內文（中文） 的差異');
    expect(within(body).getByText('−1 / +1')).toBeInTheDocument();
    expect(within(body).getByText('第二行')).toBeInTheDocument();
    expect(within(body).getByText('改過的第二行')).toBeInTheDocument();
    // The tags field differs too, so it gets its own section rather than being folded into the body.
    expect(screen.getByLabelText('標籤 的差異')).toBeInTheDocument();
  });

  it('announces a removal and an addition to a screen reader, not only by colour', async () => {
    const { user } = setup();
    await user.click(screen.getAllByRole('button', { name: /與目前比較/ })[1]);
    const body = await screen.findByLabelText('內文（中文） 的差異');
    expect(within(body).getByText('刪除：')).toBeInTheDocument();
    expect(within(body).getByText('新增：')).toBeInTheDocument();
  });

  it('collapses the comparison when the same revision is asked for again', async () => {
    const { user } = setup();
    // The label flips to 收合比較 once open, so the button is found inside its own row instead.
    const row = screen.getAllByRole('listitem')[0];
    const compare = () => within(row).getByRole('button', { name: /比較/ });
    await user.click(compare());
    await waitFor(() => expect(screen.getByLabelText('標籤 的差異')).toBeInTheDocument());
    expect(compare()).toHaveAttribute('aria-expanded', 'true');
    await user.click(compare());
    await waitFor(() => expect(screen.queryByLabelText('標籤 的差異')).not.toBeInTheDocument());
    expect(server.diffCalls).toHaveLength(1);
  });

  it('says so when a revision matches the article instead of showing an empty diff', async () => {
    const { user } = setup();
    server.current = { ...server.snapshots[2] };
    await user.click(screen.getAllByRole('button', { name: /與目前比較/ })[0]);
    await waitFor(() => expect(screen.getByText('這個版本與目前內容相同。')).toBeInTheDocument());
  });

  it('reports a failed comparison as an alert', async () => {
    const { user } = setup();
    server.diffFails = true;
    await user.click(screen.getAllByRole('button', { name: /與目前比較/ })[0]);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('找不到這個修訂版本。'));
  });

  it('asks for confirmation before restoring and sends the chosen revision', async () => {
    const { user } = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await user.click(screen.getAllByRole('button', { name: /還原此版/ })[0]);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('還原第 2 版'));
    expect(server.restoreCalls).toHaveLength(0);

    confirm.mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: /還原此版/ })[1]);
    await waitFor(() => expect(server.restoreCalls).toHaveLength(1));
    expect(Object.fromEntries(server.restoreCalls[0])).toMatchObject({ id: postId, revision: '1' });
    expect(await screen.findByRole('status')).toHaveTextContent('已轉為草稿');
  });
});
