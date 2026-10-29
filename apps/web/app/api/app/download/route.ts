import { NextResponse, type NextRequest } from 'next/server';
import { getEpisodes, getProfile, getTitleBySlug, partLabel } from '@cinewave/shared';
import { bearerClient, requestCountry } from '@/lib/supabase/bearer';
import { downloadRendition, muxConfigured, signedFileUrl } from '@/lib/mux';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * For the Android app: issues an offline-download licence for THIS phone
 * (only if the plan, the film's rights and the device limit allow it) and
 * a one-time link to fetch the file into the app's private storage.
 *
 * status: 'ready' | 'preparing' (Mux is making the download copy; try again
 * in a few minutes) | 'refused' (reason says why).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const part = req.nextUrl.searchParams.get('part');
  const { sb, user } = await bearerClient(req);
  if (!user) return json({ status: 'refused', reason: 'sign_in_required' }, 401);

  const title = slug ? await getTitleBySlug(sb, slug) : null;
  if (!title) return json({ status: 'refused', reason: 'not_found' }, 404);

  const profile = await getProfile(sb, user.id);
  const country = profile?.country_code ?? requestCountry(req);

  let episode: { id: string; label: string; name: string | null } | null = null;
  if (title.kind === 'series') {
    const eps = (await getEpisodes(sb, title.id)).filter((e) => e.published);
    const ep = eps.find((e) => e.id === part);
    if (!ep) return json({ status: 'refused', reason: 'not_found' }, 404);
    const multi = new Set(eps.map((e) => e.season)).size > 1;
    episode = { id: ep.id, label: partLabel(ep, multi), name: ep.name };
  }

  const { data, error } = await sb.rpc('issue_download', { t_id: title.id, e_id: episode?.id ?? null, country });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { download_id: string | null; expires_at: string | null; playback_id: string | null; asset_id: string | null; reason: string }
    | undefined;
  if (error || !row) return json({ status: 'refused', reason: 'error' }, 500);
  if (row.reason !== 'ok' || !row.playback_id) return json({ status: 'refused', reason: row.reason });
  if (!muxConfigured() || !row.asset_id) return json({ status: 'refused', reason: 'no_video' });

  try {
    const r = await downloadRendition(row.asset_id);
    if (r.status === 'preparing') return json({ status: 'preparing' });
    if (r.status === 'unavailable') return json({ status: 'refused', reason: 'no_video' });
    const url = await signedFileUrl(sb, row.playback_id, r.name);
    if (!url) return json({ status: 'refused', reason: 'error' }, 500);
    return json({
      status: 'ready',
      download_id: row.download_id,
      expires_at: row.expires_at,
      url,
      bytes: r.bytes,
      title: { id: title.id, slug: title.slug, title: title.title, kind: title.kind ?? 'movie', poster_url: title.poster_url, backdrop_url: title.backdrop_url },
      episode,
    });
  } catch {
    return json({ status: 'refused', reason: 'error' }, 502);
  }
}
