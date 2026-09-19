import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/admin', () => ({ requireAdmin: vi.fn() }));
import { requireAdmin } from '@/lib/auth/admin';
import { assetHandler, assetJson } from '@/lib/assets/http';

const url = 'https://portfolio.example/api/admin/assets';
const request = (body: string, origin = 'https://portfolio.example') =>
  new Request(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
beforeEach(() => {
  vi.mocked(requireAdmin).mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' });
});

describe('asset HTTP boundary', () => {
  it('rejects unauthenticated calls without invoking privileged storage work', async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error('UNAUTHORIZED'));
    const work = vi.fn();
    const result = await assetHandler(new Request(url), work);
    expect(result.status).toBe(401);
    expect(work).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects cross-origin and origin-less writes even for an admin', async () => {
    const work = vi.fn();
    expect((await assetHandler(request('{}', 'https://attacker.example'), work)).status).toBe(403);
    expect((await assetHandler(new Request(url, { method: 'POST' }), work)).status).toBe(403);
    expect(work).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor, not an actor ID from a submitted body', async () => {
    const work = vi.fn(async actor => actor);
    const result = await assetHandler(request('{"actor":"attacker"}'), work);
    expect(result.status).toBe(200);
    expect(work).toHaveBeenCalledWith('admin-id');
  });
  it('returns a setup error for missing migrations, and redacts unexpected internal errors', async () => {
    const missing = await assetHandler(new Request(url), async () => {
      throw { code: 'PGRST202' };
    });
    expect(missing.status).toBe(503);
    expect((await missing.json()).setupRequired).toBe(true);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = await assetHandler(new Request(url), async () => {
      throw new Error('secret-token: signed-url');
    });
    expect(await failure.text()).not.toContain('secret-token');
    expect(JSON.stringify(log.mock.calls)).not.toContain('signed-url');
  });
  it('only reads bounded JSON objects; rejects multipart, arrays, null, malformed and oversized requests', async () => {
    expect(await assetJson(request('{"action":"trash"}'))).toEqual({ action: 'trash' });
    for (const body of ['[]', 'null', 'bad', `{"a":"${'x'.repeat(16384)}"}`])
      await expect(assetJson(request(body))).rejects.toThrow('INVALID_REQUEST');
    await expect(assetJson(new Request(url, { method: 'POST', body: new FormData() }))).rejects.toThrow('INVALID_REQUEST');
  });
});
