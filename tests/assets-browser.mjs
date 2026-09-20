// Isolated UI + TUS protocol test. No production route, login bypass or Supabase credentials.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const output = resolve('artifacts/asset-library');
await mkdir(output, { recursive: true });
const bundle = await build({
  entryPoints: ['tests/fixtures/asset-workspace.tsx'],
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});
const globals = await postcss([tailwind()]).process(await readFile('src/app/globals.css', 'utf8'), {
  from: resolve('src/app/globals.css'),
});
// The admin shell stylesheet is optional here: the workspace styles itself through assets.css.
const adminCss = await readFile('src/styles/admin.css', 'utf8').catch(() => '');
const css = globals.css + adminCss + (await readFile('src/styles/assets.css', 'utf8'));
const server = createServer(async (req, res) => {
  if (req.url === '/bundle.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(bundle.outputFiles[0].contents);
  } else if (req.url === '/styles.css') {
    res.setHeader('Content-Type', 'text/css');
    res.end(css);
  } else if (req.url.startsWith('/preview.jpg')) {
    res.setHeader('Content-Type', 'image/png');
    res.end(await readFile('public/demo/portrait-cut.png'));
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Asset library test</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('Browser:', error.message);
  });
  page.on('console', message => {
    if (message.type() === 'error') console.error('Console:', message.text());
  });
  const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
  const now = '2026-09-20T04:00:00Z';
  const version = (n, name) => ({
    id: id(1000 + n),
    asset_id: id(n),
    owner_id: id(999),
    request_id: id(2000 + n),
    version_no: 1,
    original_name: name,
    object_path: `owner/${n}/original.jpg`,
    mime_type: 'image/jpeg',
    size_bytes: 240000,
    sha256: 'a'.repeat(64),
    status: 'ready',
    last_error: null,
    created_at: now,
    completed_at: now,
  });
  const assets = Array.from({ length: 28 }, (_, i) => ({
    id: id(i + 1),
    owner_id: id(999),
    name: i === 0 ? '個人照-原始檔.jpg' : `Architecture-${i + 1}.jpg`,
    current_version_id: id(1001 + i),
    version_count: 1,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    current: version(i + 1, `Architecture-${i + 1}.jpg`),
    published: false,
  }));
  let next = 40;
  const requests = [];
  let failPublish = true;
  let pendingPublication;
  let completedPublication;
  const history = [];
  await page.route('**/api/admin/assets*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = data => route.fulfill({ json: { ok: true, data } });
    if (request.method() === 'GET') {
      if (url.searchParams.has('id')) {
        const asset = assets.find(a => a.id === url.searchParams.get('id'));
        return respond({
          asset,
          versions: [asset.current],
          publications:
            completedPublication && completedPublication.asset_id === asset.id
              ? [completedPublication]
              : pendingPublication && pendingPublication.asset_id === asset.id
                ? [pendingPublication]
                : [],
          events: history,
          references:
            completedPublication && completedPublication.asset_id === asset.id && completedPublication.status === 'complete' && asset.name.includes('portrait')
              ? [{ publication_id: completedPublication.id, url: completedPublication.public_url, kind: 'profile', id: null, slug: null, title: 'avatar', field: 'avatar', soft: false }]
              : [],
        });
      }
      if (url.searchParams.get('view') === 'activity') return respond({ events: history, count: history.length, page: 1 });
      if (url.searchParams.get('view') === 'published') {
        const q = url.searchParams.get('q') || '';
        const published = [
          { id: id(7001), asset_id: id(1), name: '首頁封面.webp', slot: 'public', public_url: `${origin}/preview.jpg`, mime_type: 'image/webp', size: 180000, completed_at: now, width: 1600, height: 900 },
          { id: id(7002), asset_id: id(2), name: 'architecture-diagram.png', slot: 'public', public_url: `${origin}/preview.jpg?2`, mime_type: 'image/webp', size: 90000, completed_at: now, width: null, height: null },
        ].filter(item => item.name.includes(q));
        return respond({ items: published, count: published.length, page: 1 });
      }
      if (url.searchParams.get('view') === 'legacy')
        return respond({ items: [{ name: 'legacy.jpg', folder: false, url: '/preview.jpg', path: 'legacy.jpg', size: 100 }], more: false });
      const found = assets.filter(
        a => Boolean(a.deleted_at) === (url.searchParams.get('view') === 'trash') && a.name.includes(url.searchParams.get('q') || ''),
      );
      const pageNumber = Number(url.searchParams.get('page')) || 1;
      return respond({
        items: found.slice((pageNumber - 1) * 25, pageNumber * 25),
        count: found.length,
        page: pageNumber,
        usedBytes: 240000 * assets.length,
      });
    }
    const body = request.postDataJSON();
    requests.push(body);
    const asset = assets.find(a => a.id === body.id || a.current.id === body.versionId || (body.publicationId && completedPublication && a.id === completedPublication.asset_id));
    if (body.action === 'rename') asset.name = body.value;
    if (body.action === 'trash') asset.deleted_at = now;
    if (body.action === 'restore') asset.deleted_at = null;
    if (['rename', 'trash', 'restore'].includes(body.action)) {
      history.unshift({
        id: history.length + 1,
        actor_id: id(999),
        asset_id: asset.id,
        version_id: asset.current.id,
        action: `asset.${body.action}`,
        detail: {},
        created_at: now,
      });
      return respond(asset);
    }
    if (body.action === 'preview') return respond({ url: `${origin}/preview.jpg` });
    if (body.action === 'revoke') {
      completedPublication = { ...completedPublication, status: 'revoked', revoked_at: now, purged_at: now };
      asset.published = false;
      return respond(completedPublication);
    }
    if (body.action === 'upload') {
      const previous = assets.find(a => a.current.request_id === body.requestId);
      if (previous) return respond({ version: previous.current, token: 'test-only', endpoint: `${origin}/storage/v1/upload/resumable` });
      const n = next++;
      const v = { ...version(n, body.name), request_id: body.requestId, mime_type: body.mime, size_bytes: body.size, status: 'pending' };
      assets.push({
        id: id(n),
        owner_id: id(999),
        name: body.name,
        current: v,
        current_version_id: v.id,
        version_count: 1,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      });
      return respond({ version: v, token: 'test-only', endpoint: `${origin}/storage/v1/upload/resumable` });
    }
    if (body.action === 'complete') {
      asset.current.status = 'ready';
      return respond(asset.current);
    }
    if (body.action === 'publish') {
      pendingPublication = {
        id: id(5000),
        asset_id: asset.id,
        version_id: asset.current.id,
        request_id: body.requestId,
        slot: body.slot,
        status: 'pending',
        created_at: now,
      };
      if (failPublish) {
        failPublish = false;
        return route.fulfill({ status: 503, json: { ok: false, message: 'Temporary storage failure', requestId: id(9000) } });
      }
      completedPublication = { ...pendingPublication, status: 'complete', completed_at: now, public_url: `${origin}/preview.jpg` };
      asset.published = true;
      return respond(completedPublication);
    }
    throw new Error(`Unhandled action ${body.action}`);
  });
  let uploadBytes = 0;
  let tusRequests = 0;
  await page.route('**/storage/v1/upload/resumable**', async route => {
    const request = route.request();
    tusRequests++;
    assert.equal(request.headers()['x-signature'], 'test-only');
    const count = request.postDataBuffer()?.length || 0;
    uploadBytes += count;
    assert.ok(count <= 6 * 1024 * 1024, 'TUS chunks must not exceed 6 MiB');
    return route.fulfill({
      status: request.method() === 'POST' ? 201 : 204,
      headers: { 'Tus-Resumable': '1.0.0', Location: `${origin}/storage/v1/upload/resumable/test`, 'Upload-Offset': String(uploadBytes) },
    });
  });

  await page.goto(origin);
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: '下一頁', exact: true }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '上一頁', exact: true }).click();
  await page.getByRole('button', { name: '檢視 個人照-原始檔.jpg', exact: true }).click();
  await page.getByRole('button', { name: '預覽', exact: true }).click();
  await expect(page.getByRole('img', { name: '個人照-原始檔.jpg' })).toBeVisible();
  // Real pixels, not just an <img> in the DOM. Decoding a 760 KB PNG can lag behind visibility on a
  // loaded machine, so this polls instead of reading naturalWidth once.
  await expect
    .poll(() => page.getByRole('img', { name: '個人照-原始檔.jpg' }).evaluate(image => image.complete && image.naturalWidth > 0), { timeout: 15000 })
    .toBe(true);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
    if (width === 390) await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const accessibility = await new AxeBuilder({ page }).include('.asset-workspace').analyze();
  assert.deepEqual(
    accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })),
    [],
  );
  await page.getByLabel('名稱', { exact: true }).fill('Renamed-portrait.jpg');
  await page.getByRole('button', { name: '儲存名稱' }).click();
  await expect(page.getByRole('status').filter({ hasText: '名稱已更新' })).toBeVisible();
  await page.getByRole('button', { name: '移至垃圾桶', exact: true }).click();
  await expect(page.getByRole('button', { name: '還原檔案', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '垃圾桶', exact: true }).click();
  await page.getByRole('button', { name: '檢視 Renamed-portrait.jpg', exact: true }).click();
  await page.getByRole('button', { name: '還原檔案', exact: true }).click();
  await expect(page.getByRole('button', { name: '移至垃圾桶', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '發布', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary storage failure');
  await page.getByRole('button', { name: '發布', exact: true }).click();
  await expect(page.getByRole('button', { name: '複製公開連結' })).toBeVisible();
  const publishes = requests.filter(r => r.action === 'publish');
  assert.equal(publishes[0].requestId, publishes[1].requestId, 'retry must reuse operation ID');
  await expect(page.getByRole('button', { name: '移至垃圾桶', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: /個人資料（個人照）/ })).toBeVisible();
  await page.getByRole('button', { name: '上傳檔案', exact: true }).click();
  const bytes = Buffer.alloc(7 * 1024 * 1024);
  bytes.write('%PDF-1.4');
  await page
    .getByLabel('選擇上傳檔案', { exact: true })
    .setInputFiles({ name: 'technical-notes.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.getByRole('button', { name: '上傳', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '已保存' })).toBeVisible({ timeout: 20000 });
  assert.equal(uploadBytes, bytes.length);
  assert.equal(tusRequests, 2, '7 MiB file uploads in two TUS chunks, never through the admin API');
  assert.equal(requests.filter(r => r.action === 'upload').length, 1);
  await page.getByRole('button', { name: '操作紀錄', exact: true }).click();
  await expect(page.getByRole('button', { name: /重新命名/ })).toBeVisible();
  await page.getByRole('button', { name: '既有公開檔案', exact: true }).click();
  await expect(page.getByRole('link', { name: /legacy.jpg/ })).toBeVisible();
  // Editor-side picker: search, pick, and the dialog hands back only a public URL.
  await page.getByRole('button', { name: '從素材庫選擇' }).click();
  const dialog = page.getByRole('dialog', { name: '素材庫：已發布的檔案' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: `${output}/picker.png` });
  const pickerAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  assert.deepEqual(
    pickerAccessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })),
    [],
  );
  await dialog.getByLabel('搜尋素材名稱').fill('architecture');
  await dialog.getByRole('button', { name: '搜尋', exact: true }).click();
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await dialog.getByRole('button', { name: '選用', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('picked')).toHaveText(`${origin}/preview.jpg?2`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '從素材庫選擇' }).click();
  await expect(dialog).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'picker overflow at 390');
  await page.screenshot({ path: `${output}/picker-mobile.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Revoking: the referenced portrait copy is protected; an unreferenced copy can be revoked, after
  // which the asset can be recycled.
  await page.getByRole('button', { name: '私人素材', exact: true }).click();
  await page.getByRole('button', { name: '檢視 Renamed-portrait.jpg', exact: true }).click();
  await expect(page.getByRole('button', { name: '仍有頁面使用，無法撤銷公開' })).toBeDisabled();
  await page.getByRole('button', { name: '檢視 Architecture-2.jpg', exact: true }).click();
  await page.getByRole('button', { name: '發布', exact: true }).click();
  await expect(page.getByRole('button', { name: '複製公開連結' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '撤銷公開 公開連結' }).click();
  await expect(page.getByText(/已撤銷/)).toBeVisible();
  await expect(page.getByRole('button', { name: '移至垃圾桶', exact: true })).toBeEnabled();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real components, responsive widths 320-1920, preview pixels, axe, pagination, rename, trash/restore, references, publication retry, audit, legacy, 7 MiB TUS upload, asset picker, revoke',
  );
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
