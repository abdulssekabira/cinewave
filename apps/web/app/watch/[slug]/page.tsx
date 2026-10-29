import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEntitlement, getEpisodes, getProfile, getTitleBySlug, partLabel } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { BackIcon } from '@/components/Icons';
import { VideoPlayer, type PlayerEpisode } from '@/components/VideoPlayer';
import { signedStreamUrl } from '@/lib/mux';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ part?: string }> };

export const metadata: Metadata = { title: 'Watch' };

/**
 * The entitlement check runs on the server BEFORE the player renders.
 * The page then asks for a short-lived signed Mux stream URL.
 * For a series, `?part=<id>` picks the part; without it the viewer
 * continues the part they were on (or starts at Part 1).
 */
export default async function WatchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { part } = await searchParams;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const country = await viewerCountry(profile?.country_code);
  const ent = await getEntitlement(sb, title.id, country);
  if (!ent.can_play) redirect(`/title/${slug}`);

  const { data: plan } = await sb.from('plans').select('max_quality').eq('id', ent.user_plan ?? 'free').maybeSingle();
  const sign = async (playbackId: unknown) =>
    playbackId ? signedStreamUrl(sb, playbackId as string, { maxResolution: plan?.max_quality ?? '720p' }) : null;

  const { data: seriesRow } = user
    ? await sb.from('watch_progress').select('position_seconds, completed, updated_at, episode_id').eq('title_id', title.id).maybeSingle()
    : { data: null };

  let src: string | null = null;
  let startAt = 0;
  let startAtUpdated: string | null = null;
  let episode: PlayerEpisode | null = null;

  if (title.kind === 'series') {
    const eps = (await getEpisodes(sb, title.id)).filter((e) => e.published);
    if (!eps.length) redirect(`/title/${slug}`);
    const multi = new Set(eps.map((e) => e.season)).size > 1;
    const current = eps.find((e) => e.id === part) ?? eps.find((e) => e.id === seriesRow?.episode_id) ?? eps[0];
    const i = eps.indexOf(current);
    const next = eps[i + 1];

    const { data: pid } = await sb.rpc('playback_id_for_episode', { e_id: current.id, country });
    src = await sign(pid);
    if (user) {
      const { data } = await sb
        .from('episode_progress')
        .select('position_seconds, completed, updated_at')
        .eq('episode_id', current.id)
        .maybeSingle();
      if (data) startAtUpdated = data.updated_at;
      if (data && !data.completed) startAt = data.position_seconds;
    }
    episode = {
      id: current.id,
      label: partLabel(current, multi),
      name: current.name,
      next: next ? { label: partLabel(next, multi), name: next.name, href: `/watch/${slug}?part=${next.id}` } : null,
    };
  } else {
    const { data: pid } = await sb.rpc('playback_id_for', { t_id: title.id, country });
    src = await sign(pid);
    if (seriesRow) startAtUpdated = seriesRow.updated_at;
    if (seriesRow && !seriesRow.completed) startAt = seriesRow.position_seconds;
  }

  return (
    <div className="player-page">
      <div style={{ maxWidth: 1200, margin: '0 auto 16px' }}>
        <Link href={`/title/${slug}`} className="btn btn-gray btn-small"><BackIcon size={18} /> {episode ? 'All parts' : 'Back'}</Link>
      </div>
      <VideoPlayer
        key={episode?.id ?? title.id}
        title={title}
        src={src}
        startAt={startAt}
        startAtUpdated={startAtUpdated}
        signedIn={Boolean(user)}
        episode={episode}
      />
    </div>
  );
}
