import { getContinueWatching, getHeroTitles, getHomeRows, progressPercent } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { HeroCarousel } from '@/components/HeroCarousel';
import { LandscapeCard, PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';

export const dynamic = 'force-dynamic';

const ROW_META: Record<string, { eyebrow: string; href?: string }> = {
  trending: { eyebrow: 'Trending', href: '/search' },
  recent: { eyebrow: 'New', href: '/search?sort=newest' },
  free: { eyebrow: 'Free to watch', href: '/search?access=free' },
};

export default async function HomePage() {
  const { sb, user } = await getUser();
  const [hero, rows, continueWatching] = await Promise.all([
    getHeroTitles(sb),
    getHomeRows(sb),
    user ? getContinueWatching(sb) : Promise.resolve([]),
  ]);

  if (!hero.length && !rows.length) {
    return (
      <div className="page">
        <div className="empty">
          <h2>The catalogue is empty</h2>
          <p>Publish a title with an active rights window to see it here.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <HeroCarousel titles={hero} />
      <div className="rows" style={{ marginTop: -24 }}>
        {continueWatching.length > 0 && (
          <Row eyebrow="Continue" label="Continue Watching" wide>
            {continueWatching.map((c) => (
              <LandscapeCard
                key={c.title.id}
                title={c.title}
                progress={progressPercent(c.position_seconds, c.duration_seconds, c.title.runtime_minutes)}
              />
            ))}
          </Row>
        )}
        {rows.map((row) => {
          const meta = ROW_META[row.key] ?? { eyebrow: 'Collection' };
          return (
            <Row key={row.key} eyebrow={meta.eyebrow} label={row.label} href={meta.href}>
              {row.titles.map((t) => <PosterCard key={t.id} title={t} />)}
            </Row>
          );
        })}
      </div>
    </>
  );
}
