import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getEntitlement, getEpisodes, partLabel, type CatalogTitle, type Entitlement } from '@cinewave/shared';
import { signedStreamUrl } from './mux';
import { signedGet } from './r2';

export type PlaybackEpisode = {
  id: string;
  label: string;
  name: string | null;
  next: { id: string; label: string; name: string | null; href: string } | null;
};

export type Playback = {
  ent: Entitlement;
  src: string | null;
  startAt: number;
  startAtUpdated: string | null;
  episode: PlaybackEpisode | null;
  noParts?: boolean;
};

/**
 * Everything a player needs, shared by the website and the Android app:
 * the entitlement decision, a short-lived signed stream URL (only when
 * allowed), and where to resume. For a series, `partId` picks the part;
 * otherwise the viewer continues the part they were on (or Part 1).
 */
export async function resolvePlayback(
  sb: SupabaseClient,
  user: User | null,
  title: CatalogTitle,
  country: string | null,
  partId?: string | null,
): Promise<Playback> {
  const ent = await getEntitlement(sb, title.id, country);
  const out: Playback = { ent, src: null, startAt: 0, startAtUpdated: null, episode: null };
  if (!ent.can_play) return out;

  const { data: plan } = await sb.from('plans').select('max_quality').eq('id', ent.user_plan ?? 'free').maybeSingle();
  // Where the video lives: Cloudflare R2 (MP4 file) or Mux (older uploads).
  const source = async (titleId: string, episodeId: string | null) => {
    const { data } = await sb.rpc('video_source', { t_id: titleId, e_id: episodeId, country });
    const row = (Array.isArray(data) ? data[0] : data) as { provider: string; ref: string } | undefined;
    if (!row?.ref) return null;
    try {
      if (row.provider === 'r2') return await signedGet(row.ref, 6 * 3600);
      return await signedStreamUrl(sb, row.ref, { maxResolution: plan?.max_quality ?? '720p' });
    } catch {
      return null;
    }
  };

  const { data: seriesRow } = user
    ? await sb.from('watch_progress').select('position_seconds, completed, updated_at, episode_id').eq('title_id', title.id).maybeSingle()
    : { data: null };

  if (title.kind === 'series') {
    const eps = (await getEpisodes(sb, title.id)).filter((e) => e.published);
    if (!eps.length) return { ...out, noParts: true };
    const multi = new Set(eps.map((e) => e.season)).size > 1;
    const current = eps.find((e) => e.id === partId) ?? eps.find((e) => e.id === seriesRow?.episode_id) ?? eps[0];
    const next = eps[eps.indexOf(current) + 1];
    out.src = await source(title.id, current.id);
    if (user) {
      const { data } = await sb.from('episode_progress').select('position_seconds, completed, updated_at').eq('episode_id', current.id).maybeSingle();
      if (data) out.startAtUpdated = data.updated_at;
      if (data && !data.completed) out.startAt = data.position_seconds;
    }
    out.episode = {
      id: current.id,
      label: partLabel(current, multi),
      name: current.name,
      next: next ? { id: next.id, label: partLabel(next, multi), name: next.name, href: `/watch/${title.slug}?part=${next.id}` } : null,
    };
    return out;
  }

  out.src = await source(title.id, null);
  if (seriesRow) out.startAtUpdated = seriesRow.updated_at;
  if (seriesRow && !seriesRow.completed) out.startAt = seriesRow.position_seconds;
  return out;
}
