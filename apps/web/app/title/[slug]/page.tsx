import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  entitlementMessage,
  genreLabel,
  getEntitlement,
  getProfile,
  getRelated,
  getTitleBySlug,
  getWatchlistIds,
  metaLine,
  PLAN_LABEL,
  posterPalette,
} from '@cinewave/shared';
import { createClient, getUser, viewerCountry } from '@/lib/supabase/server';
import { AccessBadges, PosterArt, PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';
import { WatchlistButton } from '@/components/WatchlistButton';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTitleBySlug(await createClient(), slug);
  return t ? { title: t.title, description: t.synopsis ?? undefined } : { title: 'Not found' };
}

export default async function TitlePage({ params }: Props) {
  const { slug } = await params;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const country = await viewerCountry(profile?.country_code);
  const [ent, related, watchlist] = await Promise.all([
    getEntitlement(sb, title.id, country),
    getRelated(sb, title),
    user ? getWatchlistIds(sb) : Promise.resolve(new Set<string>()),
  ]);

  const p = posterPalette(title.slug);
  const directors = title.credits.filter((c) => c.role === 'Director').map((c) => c.name);
  const cast = title.credits.filter((c) => c.role === 'Cast').map((c) => c.name);

  return (
    <>
      <section className="title-hero">
        <div className="hero-art" aria-hidden="true">
          {title.backdrop_url ? (
            <img src={title.backdrop_url} alt="" />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: `radial-gradient(ellipse at 80% 20%, ${p.to} 0%, ${p.from} 60%, #0a0b0f 100%)`,
              }}
            />
          )}
        </div>
        <div className="title-layout">
          <div className="poster-wrap">
            <div className="poster">
              <AccessBadges title={title} />
              <PosterArt title={title} />
            </div>
          </div>
          <div>
            <h1>{title.title}</h1>
            <div className="meta">{metaLine(title)}</div>
            <div className="chips">
              {title.genres.map((g) => (
                <Link key={g} href={`/search?genre=${g}`} className="chip">
                  {genreLabel(g)}
                </Link>
              ))}
            </div>
            {title.synopsis && <p className="synopsis">{title.synopsis}</p>}

            <div className="hero-actions">
              {ent.can_play ? (
                <Link href={`/watch/${title.slug}`} className="btn btn-primary">▶ Play</Link>
              ) : ent.reason === 'sign_in_required' ? (
                <Link href={`/login?next=/title/${title.slug}`} className="btn btn-primary">Sign in to watch</Link>
              ) : ent.reason === 'upgrade_required' ? (
                <Link href="/plans" className="btn btn-primary">
                  Get {PLAN_LABEL[ent.required_plan ?? 'standard']}
                </Link>
              ) : (
                <button className="btn btn-primary" disabled>Unavailable</button>
              )}
              {user ? (
                <WatchlistButton titleId={title.id} slug={title.slug} initial={watchlist.has(title.id)} />
              ) : (
                <Link href={`/login?next=/title/${title.slug}`} className="btn btn-ghost">+ My List</Link>
              )}
            </div>

            {!ent.can_play && (
              <p className="notice">{entitlementMessage(ent.reason, ent.required_plan)}</p>
            )}
            {ent.can_download && (
              <p className="notice">↓ Download for offline viewing in the CineWave Android app.</p>
            )}
            {!ent.can_download && title.downloadable && ent.can_play && (
              <p className="notice">↓ Offline downloads with <strong>Premium</strong> in the Android app.</p>
            )}
          </div>
        </div>
      </section>

      <dl className="details-grid">
        {directors.length > 0 && (
          <div><dt>Director</dt><dd>{directors.join(', ')}</dd></div>
        )}
        {cast.length > 0 && (
          <div><dt>Cast</dt><dd>{cast.join(', ')}</dd></div>
        )}
        {title.audio_languages.length > 0 && (
          <div><dt>Audio</dt><dd>{title.audio_languages.map((l) => l.toUpperCase()).join(', ')}</dd></div>
        )}
        {title.subtitle_languages.length > 0 && (
          <div><dt>Subtitles</dt><dd>{title.subtitle_languages.map((l) => l.toUpperCase()).join(', ')}</dd></div>
        )}
        <div><dt>Plan</dt><dd>{PLAN_LABEL[title.required_plan]}</dd></div>
        {title.content_warnings.length > 0 && (
          <div><dt>Content warnings</dt><dd>{title.content_warnings.join(', ')}</dd></div>
        )}
      </dl>

      {related.length > 0 && (
        <div className="rows" style={{ paddingTop: 0 }}>
          <Row label="More like this">
            {related.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        </div>
      )}
    </>
  );
}
