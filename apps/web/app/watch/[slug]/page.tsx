import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
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

  // iPhones and iPads (Safari) can't play MKV files. Until the film's MP4 copy
  // is ready, say so clearly instead of showing a player that never starts.
  const ua = (await headers()).get('user-agent') ?? '';
  const apple = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|Firefox/i.test(ua));
  const mkv = Boolean(p.src && /\.mkv(\?|$)/i.test(p.src));
  if (apple && mkv) {
    return (
      <div className="player-page">
        <div style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>{title.title}</h1>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            This film is still being prepared for iPhone and iPad. It usually takes a short while.
            You can already watch it on an Android phone or a computer.
          </p>
          <Link href={`/title/${slug}`} className="btn btn-gray" style={{ marginTop: 18 }}><BackIcon size={18} /> Back</Link>
        </div>
      </div>
    );
  }

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
