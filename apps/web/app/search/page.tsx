import type { Metadata } from 'next';
import { getGenres, searchTitles, type SearchParams } from '@cinewave/shared';
import { createClient } from '@/lib/supabase/server';
import { PosterCard } from '@/components/Poster';

export const metadata: Metadata = { title: 'Browse' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = await createClient();
  const params: SearchParams = {
    query: sp.q,
    genre: sp.genre || undefined,
    year: sp.year ? Number(sp.year) || undefined : undefined,
    access: sp.access === 'free' || sp.access === 'premium' ? sp.access : undefined,
    sort: sp.sort === 'newest' || sp.sort === 'az' ? sp.sort : 'popular',
  };
  const [results, genres] = await Promise.all([searchTitles(sb, params), getGenres(sb)]);

  return (
    <div className="page">
      <h1 className="page-title">Browse</h1>
      <form className="filters" role="search" action="/search">
        <label className="sr-only" htmlFor="q">Search titles</label>
        <input id="q" name="q" className="input" placeholder="Search titles…" defaultValue={sp.q ?? ''} />
        <select name="genre" className="select" defaultValue={sp.genre ?? ''} aria-label="Genre">
          <option value="">All genres</option>
          {genres.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
        </select>
        <select name="access" className="select" defaultValue={sp.access ?? ''} aria-label="Access">
          <option value="">Free &amp; paid</option>
          <option value="free">Free to watch</option>
          <option value="premium">Subscribers</option>
        </select>
        <select name="sort" className="select" defaultValue={sp.sort ?? 'popular'} aria-label="Sort">
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="az">A–Z</option>
        </select>
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      {results.length ? (
        <div className="grid">
          {results.map((t) => <PosterCard key={t.id} title={t} />)}
        </div>
      ) : (
        <div className="empty">
          <h2>No titles found</h2>
          <p>Try a different search or clear the filters.</p>
        </div>
      )}
    </div>
  );
}
