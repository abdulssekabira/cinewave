import Link from 'next/link';
import {
  entitlementMessage,
  genreLabel,
  getContinueWatching,
  getFeatured,
  getHomeRows,
  metaLine,
  posterPalette,
  progressPercent,
} from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { sb, user } = await getUser();
  const [featured, rows, continueWatching] = await Promise.all([
    getFeatured(sb),
    getHomeRows(sb),
    user ? getContinueWatching(sb) : Promise.resolve([]),
  ]);

  if (!featured && rows.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <h2>The catalogue is empty</h2>
          <p>Publish a title with an active rights window in the admin to see it here.</p>
        </div>
      </div>
    );
  }

  const p = featured ? posterPalette(featured.slug) : null;

  return (
    <>
      {featured && p && (
        <section className="hero" aria-label="Featured">
          <div className="hero-art">
            {featured.backdrop_url ? (
              <img src={featured.backdrop_url} alt="" />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `radial-gradient(ellipse at 75% 30%, ${p.to} 0%, ${p.from} 55%, #0a0b0f 100%)`,
                }}
              />
            )}
          </div>
          <div className="hero-content">
            <div className="eyebrow">Featured</div>
            <h1>{featured.title}</h1>
            {featured.tagline && <p className="tagline">{featured.tagline}</p>}
            <div className="meta">
              <span>{metaLine(featured)}</span>
              {featured.genres.slice(0, 2).map((g) => (
                <span key={g}>· {genreLabel(g)}</span>
              ))}
            </div>
            <div className="hero-actions">
              {featured.required_plan === 'free' ? (
                <Link href={`/title/${featured.slug}`} className="btn btn-primary">▶ Watch free</Link>
              ) : (
                <Link href={`/title/${featured.slug}`} className="btn btn-primary">See details</Link>
              )}
              <Link href={featured.required_plan === 'free' ? `/title/${featured.slug}` : '/plans'} className="btn btn-ghost">
                {featured.required_plan === 'free' ? 'More info' : 'View plans'}
              </Link>
            </div>
            {featured.required_plan !== 'free' && (
              <p className="notice">{entitlementMessage('upgrade_required', featured.required_plan)}</p>
            )}
          </div>
        </section>
      )}

      <div className="rows">
        {continueWatching.length > 0 && (
          <Row label="Continue Watching">
            {continueWatching.map((c) => (
              <PosterCard
                key={c.title.id}
                title={c.title}
                progress={progressPercent(c.position_seconds, c.duration_seconds, c.title.runtime_minutes)}
              />
            ))}
          </Row>
        )}
        {rows.map((row) => (
          <Row key={row.key} label={row.label}>
            {row.titles.map((t) => (
              <PosterCard key={t.id} title={t} />
            ))}
          </Row>
        ))}
      </div>
    </>
  );
}
