import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getProfile, getTitleBySlug } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { BackIcon } from '@/components/Icons';
import { VideoPlayer } from '@/components/VideoPlayer';
import { resolvePlayback } from '@/lib/playback';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ part?: string }> };

export const metadata: Metadata = { title: 'Watch' };

/**
 * The entitlement check runs on the server BEFORE the player renders.
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
  const p = await resolvePlayback(sb, user, title, country, part);
  if (!p.ent.can_play || p.noParts) redirect(`/title/${slug}`);

  return (
    <div className="player-page">
      <div style={{ maxWidth: 1200, margin: '0 auto 16px' }}>
        <Link href={`/title/${slug}`} className="btn btn-gray btn-small"><BackIcon size={18} /> {p.episode ? 'All parts' : 'Back'}</Link>
      </div>
      <VideoPlayer
        key={p.episode?.id ?? title.id}
        title={title}
        src={p.src}
        startAt={p.startAt}
        startAtUpdated={p.startAtUpdated}
        signedIn={Boolean(user)}
        episode={p.episode}
      />
    </div>
  );
}
