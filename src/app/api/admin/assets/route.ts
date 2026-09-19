import { assetHandler, assetJson } from '@/lib/assets/http';
import { assetDetail, beginAssetUpload, changeAsset, finishAssetUpload, listAssets, listAssetEvents, listLegacyAssets, listPublished, previewAsset, publishAsset } from '@/lib/assets/server';
import { assetName, isPublishSlot, isUuid } from '@/lib/assets/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return assetHandler(request, async actor => {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(10000, Math.floor(Number(params.get('page')) || 1)));
    if (params.get('view') === 'activity') return listAssetEvents(actor, page);
    if (params.get('view') === 'legacy') return listLegacyAssets(params.get('bucket') || 'media', params.get('prefix') || '', page);
    if (params.get('view') === 'published') return listPublished(actor, params);
    const id = params.get('id');
    if (id) {
      if (!isUuid(id)) throw new Error('INVALID_REQUEST');
      return assetDetail(actor, id);
    }
    return listAssets(actor, params);
  });
}

export async function POST(request: Request) {
  return assetHandler(request, async actor => {
    const body = await assetJson(request);
    if (body.action === 'upload') return beginAssetUpload(actor, body);
    if (['complete', 'preview', 'publish'].includes(String(body.action))) {
      if (!isUuid(body.versionId)) throw new Error('INVALID_REQUEST');
      if (body.action === 'complete') return finishAssetUpload(actor, body.versionId);
      if (body.action === 'preview') return { url: await previewAsset(actor, body.versionId) };
      if (!isPublishSlot(body.slot) || !isUuid(body.requestId)) throw new Error('INVALID_REQUEST');
      return publishAsset(actor, body.versionId, body.slot, body.requestId);
    }
    if (!isUuid(body.id) || !['rename', 'trash', 'restore', 'version', 'cancel'].includes(String(body.action))) throw new Error('INVALID_REQUEST');
    if (['version', 'cancel'].includes(String(body.action)) && !isUuid(body.value)) throw new Error('INVALID_REQUEST');
    return changeAsset(actor, body.id, String(body.action), body.action === 'rename' ? assetName(body.value) : typeof body.value === 'string' ? body.value : undefined);
  });
}
