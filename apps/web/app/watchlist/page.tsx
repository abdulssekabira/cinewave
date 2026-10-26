import type { Metadata } from 'next';
import Link from 'next/link';
import { getWatchlist } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { PosterCard } from '@/components/Poster';

export const metadata: Metadata = { title: 'My List' };

export default async function WatchlistPage() {
  const { sb } = await getUser();
  const titles = await getWatchlist(sb);

  return (
    <div className="page">
      <h1 className="page-title">My List</h1>
      {titles.length ? (
        <div className="grid">
          {titles.map((t) => <PosterCard key={t.id} title={t} />)}
        </div>
      ) : (
        <div className="empty">
          <h2>Your list is empty</h2>
          <p>Add films with “+ My List” and they’ll show up here on every device.</p>
          <Link href="/search" className="btn btn-accent" style={{ marginTop: 16 }}>Browse films</Link>
        </div>
      )}
    </div>
  );
}
