'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';
import { completeMultipart, createMultipart, ensureCors, headObject, listParts, PART_SIZE, r2Configured, signParts } from '@/lib/r2';

type Started = { mediaId?: string; partSize?: number; done?: { n: number; etag: string }[]; error?: string };

async function origins() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const list = new Set(['https://www.glemovies.com', 'https://glemovies.com', 'https://cinewave-gray-xi.vercel.app']);
  if (host) list.add(`${host.startsWith('localhost') ? 'http' : 'https'}://${host}`);
  return [...list];
}

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/AccessDenied|Unauthorized|403/.test(m)) {
    return 'Cloudflare refused the request. Check the R2 keys in Vercel (the token needs “Admin Read & Write”), then redeploy.';
  }
  return m;
};

/**
 * Starts an upload to Cloudflare, or continues one for the same file that
 * was interrupted (resumeId from this phone's memory). Returns which pieces
 * are already stored so only the rest are sent.
 */
export async function startR2Upload(
  titleId: string,
  episodeId: string | null,
  file: { name: string; size: number; type: string },
  resumeId?: string | null,
): Promise<Started> {
  const { sb } = await requireStaff();
  if (!r2Configured()) return { error: 'Cloudflare storage isn’t connected yet. Add the R2 keys in Vercel, then redeploy.' };
  if (!(file.size > 0)) return { error: 'This file is empty.' };
  if (file.size > 40 * 1024 ** 3) return { error: 'This file is larger than 40 GB.' };
  try {
    await ensureCors(await origins());
  } catch (e) {
    return { error: friendly(e) };
  }

  if (resumeId) {
    const { data: m } = await sb.from('media_assets').select('id, title_id, episode_id, status, asset_id, upload_id, size_bytes, provider').eq('id', resumeId).maybeSingle();
    if (m && m.provider === 'r2' && m.status === 'pending' && m.title_id === titleId && (m.episode_id ?? null) === episodeId && Number(m.size_bytes) === file.size && m.upload_id) {
      try {
        const done = await listParts(m.asset_id, m.upload_id);
        return { mediaId: m.id, partSize: PART_SIZE, done: done.filter((p) => p.etag).map((p) => ({ n: p.n, etag: p.etag })) };
      } catch {
        /* the old upload expired: start a new one below */
      }
    }
  }

  const ext = (/\.([a-z0-9]{2,4})$/i.exec(file.name)?.[1] ?? 'mp4').toLowerCase();
  const key = `films/${titleId}/${episodeId ? `part-${episodeId}` : 'film'}-${Date.now()}.${ext}`;
  try {
    const uploadId = await createMultipart(key, file.type || 'video/mp4');
    const { data, error } = await sb.from('media_assets').insert({
      title_id: titleId,
      episode_id: episodeId,
      kind: 'feature',
      provider: 'r2',
      asset_id: key,
      upload_id: uploadId,
      status: 'pending',
      size_bytes: file.size,
    }).select('id').single();
    if (error) return { error: error.message };
    return { mediaId: data.id, partSize: PART_SIZE, done: [] };
  } catch (e) {
    return { error: friendly(e) };
  }
}

/** Signed links for the next pieces. */
export async function signR2Parts(mediaId: string, parts: number[]): Promise<{ urls?: { n: number; url: string }[]; error?: string }> {
  const { sb } = await requireStaff();
  const { data: m } = await sb.from('media_assets').select('asset_id, upload_id, status, provider').eq('id', mediaId).maybeSingle();
  if (!m || m.provider !== 'r2' || m.status !== 'pending' || !m.upload_id) return { error: 'This upload has ended. Choose the file again.' };
  try {
    return { urls: await signParts(m.asset_id, m.upload_id, parts.slice(0, 50)) };
  } catch (e) {
    return { error: friendly(e) };
  }
}

/** Joins the pieces into the finished file and makes it playable. */
export async function completeR2Upload(
  titleId: string,
  episodeId: string | null,
  mediaId: string,
  parts: { n: number; etag: string }[],
  durationSeconds: number | null,
): Promise<{ ok?: boolean; error?: string }> {
  const { sb } = await requireStaff();
  const { data: m } = await sb.from('media_assets').select('asset_id, upload_id, status, provider, size_bytes').eq('id', mediaId).maybeSingle();
  if (!m || m.provider !== 'r2' || !m.upload_id) return { error: 'This upload has ended. Choose the file again.' };
  if (m.status === 'ready') return { ok: true };
  try {
    await completeMultipart(m.asset_id, m.upload_id, parts);
    const head = await headObject(m.asset_id);
    if (!head || head.size !== Number(m.size_bytes)) return { error: 'The file didn’t arrive completely. Try the upload again.' };
    const dur = durationSeconds && Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null;
    // MP4/MOV/WebM play everywhere; MKV plays on Android (Chrome and the app),
    // and the conversion step later makes an MP4 copy for iPhones too.
    // Other formats (e.g. AVI) wait for the conversion before viewers can play.
    const playable = /\.(mp4|m4v|mov|webm|mkv)$/i.test(m.asset_id);
    const { error } = await sb.from('media_assets').update({
      status: playable ? 'ready' : 'processing',
      playback_id: playable ? m.asset_id : null,
      stream_bytes: head.size,
      duration_seconds: dur,
      upload_id: null,
      transcode_status: 'waiting',
      updated_at: new Date().toISOString(),
    }).eq('id', mediaId);
    if (error) return { error: error.message };
    const mins = dur ? Math.max(1, Math.round(dur / 60)) : null;
    if (mins && episodeId) await sb.from('episodes').update({ runtime_minutes: mins }).eq('id', episodeId).is('runtime_minutes', null);
    else if (mins) await sb.from('titles').update({ runtime_minutes: mins }).eq('id', titleId).is('runtime_minutes', null);
    revalidatePath(`/admin/titles/${titleId}`);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { error: friendly(e) };
  }
}
