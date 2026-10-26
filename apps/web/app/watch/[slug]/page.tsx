import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getEntitlement, getProfile, getTitleBySlug } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';

type Props = { params: Promise<{ slug: string }> };

/**
 * Player page. The entitlement check happens on the server BEFORE anything
 * is shown — this is where the signed playback token will be issued in
 * Phase 3 (video provider integration).
 */
export default async function WatchPage({ params }: Props) {
  const { slug } = await params;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const ent = await getEntitlement(sb, title.id, await viewerCountry(profile?.country_code));
  if (!ent.can_play) redirect(`/title/${slug}`);

  return (
    <div className="page">
      <div
        style={{
          aspectRatio: '16 / 9',
          maxWidth: 1100,
          background: '#000',
          borderRadius: 16,
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div className="eyebrow">Player — Phase 3</div>
          <h1 className="page-title" style={{ marginBottom: 8 }}>{title.title}</h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460 }}>
            You’re entitled to watch this title. The video player connects once the
            video provider is set up.
          </p>
          <Link href={`/title/${slug}`} className="btn btn-ghost" style={{ marginTop: 12 }}>Back to title</Link>
        </div>
      </div>
    </div>
  );
}
