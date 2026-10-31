import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { formatRuntime, getEpisodeProgress, getEpisodes, getProfile, getRelated, getTitleBySlug, partLabel, vjLabel } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { BackIcon, PlayIcon } from '@/components/Icons';
import { PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';
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
  const [related, episodes] = await Promise.all([
    getRelated(sb, title).catch(() => []),
    title.kind === 'series' ? getEpisodes(sb, title.id).then((e) => e.filter((x) => x.published)).catch(() => []) : Promise.resolve([]),
  ]);
  const epProgress = user && episodes.length ? await getEpisodeProgress(sb, episodes.map((e) => e.id)).catch(() => new Map()) : new Map();
  const multiSeason = new Set(episodes.map((e) => e.season)).size > 1;

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

      {/* Under the player: what's playing, the other parts, and more to watch. */}
      <div className="watch-below">
        <div className="watch-info">
          <h1 className="watch-title">{title.title}</h1>
          <div className="watch-sub">
            {title.vj_name && <span className="watch-vj">{vjLabel(title.vj_name)}</span>}
            {p.episode && <span>{p.episode.label}{p.episode.name ? ` · ${p.episode.name}` : ''}</span>}
            {title.release_year && <span>{title.release_year}</span>}
          </div>
        </div>

        {episodes.length > 1 && (
          <section className="parts" aria-labelledby="w-parts">
            <h2 className="section-h" id="w-parts">Parts <span className="parts-count">{episodes.length}</span></h2>
            <ol className="parts-list">
              {episodes.map((e) => {
                const pr = epProgress.get(e.id);
                const dur = pr?.duration_seconds || (e.runtime_minutes ?? 0) * 60;
                const pct = pr ? (pr.completed ? 100 : dur ? Math.min(100, (pr.position_seconds / dur) * 100) : 0) : 0;
                const now = p.episode?.id === e.id;
                const art = e.still_url ?? title.backdrop_url ?? title.poster_url;
                return (
                  <li key={e.id}>
                    <Link href={`/watch/${title.slug}?part=${e.id}`} className={`part${now ? ' current' : ''}`} aria-current={now ? 'true' : undefined}>
                      <div className="part-thumb">
                        {art ? <img src={art} alt="" loading="lazy" /> : <div className="part-thumb-fill" />}
                        <span className="part-play" aria-hidden="true"><PlayIcon size={16} /></span>
                        {pct > 0 && <div className="part-progress"><div style={{ width: `${pct}%` }} /></div>}
                      </div>
                      <div className="part-text">
                        <div className="part-label">
                          {partLabel(e, multiSeason)}
                          {now && <span className="part-now">Playing</span>}
                          {!now && pr?.completed && <span className="part-done">Watched</span>}
                        </div>
                        {e.name && <div className="part-name">{e.name}</div>}
                        <div className="part-meta">{e.runtime_minutes ? formatRuntime(e.runtime_minutes) : ''}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <div className="rows watch-related">
          <Row eyebrow="Watch next" label="More like this">
            {related.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        </div>
      )}
    </div>
  );
}
