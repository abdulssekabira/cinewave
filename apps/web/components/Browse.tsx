import Link from 'next/link';
import { vjLabel, type Genre, type Vj } from '@cinewave/shared';

type Counts = { genres: Record<string, number>; vjs: Record<string, number>; years: Record<string, number> };

const SORTS = [
  { value: 'latest', label: 'Latest added' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest release' },
  { value: 'az', label: 'A–Z' },
];

/** Home-page shortcuts: browse by VJ, genre, year, type, or sort. */
export function Browse({ vjs, genres, counts }: { vjs: Vj[]; genres: Genre[]; counts: Counts }) {
  const shownVjs = vjs.filter((v) => (counts.vjs[v.slug] ?? 0) > 0);
  const shownGenres = genres.filter((g) => (counts.genres[g.slug] ?? 0) > 0);
  const years = Object.keys(counts.years).map(Number).sort((a, b) => b - a);
  return (
    <section className="browse" aria-label="Browse">
      {shownVjs.length > 0 && (
        <>
          <h2 className="browse-h">Browse by VJ</h2>
          <div className="browse-vjs">
            {shownVjs.map((v) => (
              <Link key={v.slug} href={`/search?vj=${encodeURIComponent(v.slug)}`} className="browse-vj">
                {v.photo_url
                  ? <img src={v.photo_url} alt="" />
                  : <span className="browse-vj-ini">{v.name.replace(/^vj\s+/i, '').slice(0, 2).toUpperCase()}</span>}
                <b>{vjLabel(v.name)}</b>
                <small>{counts.vjs[v.slug]} film{counts.vjs[v.slug] === 1 ? '' : 's'}</small>
              </Link>
            ))}
          </div>
        </>
      )}
      {shownGenres.length > 0 && (
        <>
          <h2 className="browse-h">Genres</h2>
          <div className="browse-chips">
            {shownGenres.map((g) => <Link key={g.slug} href={`/search?genre=${encodeURIComponent(g.slug)}`} className="browse-chip">{g.name}</Link>)}
          </div>
        </>
      )}
      {years.length > 0 && (
        <>
          <h2 className="browse-h">Year</h2>
          <div className="browse-chips">
            {years.map((y) => <Link key={y} href={`/search?year=${y}`} className="browse-chip">{y}</Link>)}
          </div>
        </>
      )}
      <h2 className="browse-h">Sort &amp; show</h2>
      <div className="browse-chips">
        <Link href="/search?kind=movie" className="browse-chip">Movies</Link>
        <Link href="/search?kind=series" className="browse-chip">Series</Link>
        {SORTS.map((o) => <Link key={o.value} href={`/search?sort=${o.value}`} className="browse-chip">{o.label}</Link>)}
      </div>
    </section>
  );
}
