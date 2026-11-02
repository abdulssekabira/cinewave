import { getContinueWatching, getFilterCounts, getGenres, getHeroTitles, getHomeRows, getVjs, progressPercent } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { HeroCarousel } from '@/components/HeroCarousel';
import { LandscapeCard, PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';
import { Browse } from '@/components/Browse';
import Link from 'next/link';
import { myReferrals, rewardLabel } from '@/lib/referrals';

export const dynamic = 'force-dynamic';

const ROW_META: Record<string, { eyebrow: string; href?: string }> = {
  trending: { eyebrow: 'Trending', href: '/search' },
  recent: { eyebrow: 'New', href: '/search' },
  free: { eyebrow: 'Free to watch', href: '/search?access=free' },
};

export default async function HomePage() {
  const { sb, user } = await getUser();
  const [hero, rows, continueWatching, vjs, genres, counts] = await Promise.all([
    getHeroTitles(sb),
    getHomeRows(sb),
    user ? getContinueWatching(sb) : Promise.resolve([]),
    getVjs(sb).catch(() => []),
    getGenres(sb).catch(() => []),
    getFilterCounts(sb).catch(() => ({ genres: {}, vjs: {}, years: {}, total: 0 })),
  ]);
  const ref = user ? await myReferrals(sb).catch(() => null) : null;
  const showInvite = Boolean(ref && ref.rewards < ref.max_rewards);

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
                progress={progressPercent(c.position_seconds, c.duration_seconds, c.episode ? null : c.title.runtime_minutes)}
                episode={c.episode}
              />
            ))}
          </Row>
        )}
        {showInvite && ref && (
          <div className="invite-banner">
            <span>🎁 Invite <b>{ref.needed} friends</b> and get <b>Standard free for {rewardLabel(ref.reward_days)}</b>
              {ref.counted > 0 ? ` · ${Math.min(ref.counted, ref.needed)} of ${ref.needed} joined` : ''}</span>
            <Link href="/account#invite" className="btn btn-accent btn-small">Get my invite link</Link>
          </div>
        )}
        <Browse vjs={vjs} genres={genres} counts={counts} />
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
