'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';
import { createDirectUpload, ensureSigningKey, getAsset, getUpload, muxConfigured } from '@/lib/mux';

export type VideoState = {
  status: 'none' | 'pending' | 'processing' | 'ready' | 'errored';
  duration?: number | null;
  error?: string | null;
};

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Starts an upload: returns a one-time URL the browser sends the file to. */
export async function startVideoUpload(titleId: string, episodeId?: string): Promise<{ url?: string; error?: string }> {
  const { sb, isAdmin } = await requireStaff();
  if (!muxConfigured()) return { error: 'Video isn’t connected yet: add MUX_TOKEN_ID and MUX_TOKEN_SECRET in Vercel, then redeploy.' };
  try {
    if (isAdmin) await ensureSigningKey(sb);
    const up = await createDirectUpload(episodeId ? `${titleId}:${episodeId}` : titleId, await origin());
    const { error } = await sb.from('media_assets').insert({
      title_id: titleId, episode_id: episodeId ?? null, kind: 'feature', provider: 'mux', upload_id: up.id, status: 'pending',
    });
    if (error) return { error: error.message };
    return { url: up.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start the upload.' };
  }
}

/** Asks Mux how the latest upload is doing and saves the answer. */
export async function refreshVideo(titleId: string, episodeId?: string): Promise<VideoState> {
  const { sb, isAdmin } = await requireStaff();
  let q = sb.from('media_assets').select('*').eq('title_id', titleId).eq('kind', 'feature');
  q = episodeId ? q.eq('episode_id', episodeId) : q.is('episode_id', null);
  const { data: m } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!m) return { status: 'none' };
  if (m.provider === 'r2' || m.status === 'ready' || m.status === 'errored' || !muxConfigured()) {
    return { status: m.status, duration: m.duration_seconds, error: m.error_text };
  }
  try {
    if (isAdmin) await ensureSigningKey(sb);
    let assetId: string | null = m.asset_id;
    let patch: Record<string, unknown> = {};
    if (!assetId && m.upload_id) {
      const up = await getUpload(m.upload_id);
      if (up.status === 'errored' || up.status === 'cancelled' || up.status === 'timed_out') {
        patch = { status: 'errored', error_text: up.error?.message ?? `Upload ${up.status}` };
      } else if (up.asset_id) {
        assetId = up.asset_id;
        patch = { asset_id: assetId, status: 'processing' };
      }
    }
    if (assetId) {
      const a = await getAsset(assetId);
      if (a.status === 'ready') {
        const pid = a.playback_ids?.find((p) => p.policy === 'signed')?.id ?? a.playback_ids?.[0]?.id ?? null;
        patch = { ...patch, status: 'ready', playback_id: pid, duration_seconds: a.duration ? Math.round(a.duration) : null };
      } else if (a.status === 'errored') {
        patch = { ...patch, status: 'errored', error_text: a.errors?.messages?.join(' ') ?? 'Mux could not process this file.' };
      }
    }
    if (Object.keys(patch).length) {
      await sb.from('media_assets').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', m.id);
      if (patch.status === 'ready') {
        // Fill in the runtime if it's empty.
        const mins = patch.duration_seconds ? Math.max(1, Math.round(Number(patch.duration_seconds) / 60)) : null;
        if (mins && episodeId) await sb.from('episodes').update({ runtime_minutes: mins }).eq('id', episodeId).is('runtime_minutes', null);
        else if (mins) await sb.from('titles').update({ runtime_minutes: mins }).eq('id', titleId).is('runtime_minutes', null);
        revalidatePath(`/admin/titles/${titleId}`);
      }
    }
    const merged = { ...m, ...patch };
    return { status: merged.status, duration: merged.duration_seconds, error: merged.error_text };
  } catch (e) {
    return { status: m.status, error: e instanceof Error ? e.message : 'Could not reach Mux.' };
  }
}
