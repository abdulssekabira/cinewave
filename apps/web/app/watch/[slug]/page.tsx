import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEntitlement, getProfile, getTitleBySlug } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { BackIcon } from '@/components/Icons';
import { VideoPlayer } from '@/components/VideoPlayer';
import { signedStreamUrl } from '@/lib/mux';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: 'Watch' };

/**
 * The entitlement check runs on the server BEFORE the player renders.
 * The page then asks for a short-lived signed Mux stream URL.
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const country = await viewerCountry(profile?.country_code);
  const ent = await getEntitlement(sb, title.id, country);
  if (!ent.can_play) redirect(`/title/${slug}`);

  // Playback ID is released only to entitled viewers (checked again in the DB),
  // then turned into a stream URL that expires after a few hours.
  const { data: playbackId } = await sb.rpc('playback_id_for', { t_id: title.id, country });
  let src: string | null = null;
  if (playbackId) {
    const { data: plan } = await sb.from('plans').select('max_quality').eq('id', ent.user_plan ?? 'free').maybeSingle();
    src = await signedStreamUrl(sb, playbackId as string, { maxResolution: plan?.max_quality ?? '720p' });
  }

  let startAt = 0;
  let startAtUpdated: string | null = null;
  if (user) {
    const { data } = await sb
      .from('watch_progress')
      .select('position_seconds, completed, updated_at')
      .eq('title_id', title.id)
      .maybeSingle();
    if (data) startAtUpdated = data.updated_at;
    if (data && !data.completed) startAt = data.position_seconds;
  }

  return (
    <div className="player-page">
      <div style={{ maxWidth: 1200, margin: '0 auto 16px' }}>
        <Link href={`/title/${slug}`} className="btn btn-gray btn-small"><BackIcon size={18} /> Back</Link>
      </div>
      <VideoPlayer title={title} src={src} startAt={startAt} startAtUpdated={startAtUpdated} signedIn={Boolean(user)} />
    </div>
  );
}
