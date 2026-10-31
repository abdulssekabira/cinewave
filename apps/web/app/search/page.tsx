import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getFilterCounts, getGenres, getVjs, searchTitles, type SearchParams } from '@cinewave/shared';
import { createClient } from '@/lib/supabase/server';
import { PosterCard } from '@/components/Poster';
import { FilterSheet } from '@/components/FilterSheet';

export const metadata: Metadata = { title: 'Browse' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sb = await createClient();
  const params: SearchParams = {
    query: sp.q,
    genre: sp.genre || undefined,
    vj: sp.vj || undefined,
    kind: sp.kind === 'movie' || sp.kind === 'series' ? sp.kind : undefined,
    year: sp.year ? Number(sp.year) || undefined : undefined,
    access: sp.access === 'free' || sp.access === 'premium' ? sp.access : undefined,
    sort: sp.sort === 'newest' || sp.sort === 'az' || sp.sort === 'popular' ? sp.sort : 'latest',
  };
  const [results, genres, vjs, counts] = await Promise.all([
    searchTitles(sb, params),
    getGenres(sb),
    getVjs(sb),
    getFilterCounts(sb),
  ]);
  const vjName = vjs.find((v) => v.slug === params.vj)?.name;
  const genreName = genres.find((g) => g.slug === params.genre)?.name;
  const heading = vjName ?? genreName ?? (params.year ? `Films from ${params.year}` : null) ?? (params.kind === 'series' ? 'Series' : params.sort === 'newest' ? 'New & Popular' : 'Movies');

  return (
    <div className="page">
      <h1 className="page-title">{heading}</h1>

      <div className="browse-bar">
        <form role="search" action="/search" className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <label className="sr-only" htmlFor="q">Search titles</label>
          <input id="q" name="q" type="search" className="input" placeholder="Search titles…" defaultValue={sp.q ?? ''} enterKeyHint="search" />
          {params.genre && <input type="hidden" name="genre" value={params.genre} />}
          {params.vj && <input type="hidden" name="vj" value={params.vj} />}
          {params.access && <input type="hidden" name="access" value={params.access} />}
          {params.kind && <input type="hidden" name="kind" value={params.kind} />}
          {params.year && <input type="hidden" name="year" value={String(params.year)} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        </form>

        <Suspense>
          <div className="fs-row" aria-label="Filters">
            {vjs.length > 0 && (
              <FilterSheet
                param="vj"
                title="VJ"
                current={params.vj ?? ''}
                options={[
                  { value: '', label: 'All VJs', count: counts.total, avatar: true },
                  ...vjs.map((v) => ({ value: v.slug, label: v.name, count: counts.vjs[v.slug] ?? 0, image: v.photo_url, avatar: true })),
                ]}
              />
            )}
            <FilterSheet
              param="kind"
              title="Show"
              current={params.kind ?? ''}
              options={[
                { value: '', label: 'Movies & series' },
                { value: 'movie', label: 'Movies' },
                { value: 'series', label: 'Series' },
              ]}
            />
            <FilterSheet
              param="genre"
              title="Genre"
              current={params.genre ?? ''}
              options={[
                { value: '', label: 'All genres', count: counts.total },
                ...genres.map((g) => ({ value: g.slug, label: g.name, count: counts.genres[g.slug] ?? 0 })),
              ]}
            />
            {Object.keys(counts.years).length > 0 && (
              <FilterSheet
                param="year"
                title="Year"
                current={params.year ? String(params.year) : ''}
                options={[
                  { value: '', label: 'All years', count: counts.total },
                  ...Object.keys(counts.years).sort((a, b) => Number(b) - Number(a)).map((y) => ({ value: y, label: y, count: counts.years[y] })),
                ]}
              />
            )}
            <FilterSheet
              param="access"
              title="Price"
              current={params.access ?? ''}
              options={[
                { value: '', label: 'Free & paid' },
                { value: 'free', label: 'Free to watch' },
                { value: 'premium', label: 'For subscribers' },
              ]}
            />
            <FilterSheet
              param="sort"
              title="Sort by"
              current={params.sort === 'latest' ? '' : params.sort!}
              options={[
                { value: '', label: 'Latest added' },
                { value: 'popular', label: 'Most popular' },
                { value: 'newest', label: 'Newest release' },
                { value: 'az', label: 'A–Z' },
              ]}
            />
          </div>
        </Suspense>
      </div>

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
