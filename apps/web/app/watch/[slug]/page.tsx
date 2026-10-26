import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEntitlement, getProfile, getTitleBySlug } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { BackIcon } from '@/components/Icons';
import { VideoPlayer } from '@/components/VideoPlayer';

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: 'Watch' };

/**
 * The entitlement check runs on the server BEFORE the player renders.
 * In Phase 3 this page also asks the video provider for a short-lived,
 * signed playback URL and passes it to the player as `src`.
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const ent = await getEntitlement(sb, title.id, await viewerCountry(profile?.country_code));
  if (!ent.can_play) redirect(`/title/${slug}`);

  let startAt = 0;
  if (user) {
    const { data } = await sb
      .from('watch_progress')
      .select('position_seconds, completed')
      .eq('title_id', title.id)
      .maybeSingle();
    if (data && !data.completed) startAt = data.position_seconds;
  }

  return (
    <div className="player-page">
      <div style={{ maxWidth: 1200, margin: '0 auto 16px' }}>
        <Link href={`/title/${slug}`} className="btn btn-gray btn-small"><BackIcon size={18} /> Back</Link>
      </div>
      <VideoPlayer title={title} src={null} startAt={startAt} signedIn={Boolean(user)} />
    </div>
  );
}
