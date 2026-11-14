import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { timeAgo } from '@cinewave/shared';
import { requireStaff } from '@/lib/admin';
import { deleteReview, setReviewHidden } from './actions';

export const metadata: Metadata = { title: 'Reviews' };

type Row = { id: string; title: string; slug: string; author: string; stars: number; body: string | null; hidden: boolean; reports: number; created_at: string };

export default async function ReviewsAdmin() {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) notFound();
  const { data } = await sb.rpc('admin_reviews', { lim: 300 });
  const rows = (data ?? []) as Row[];
  const flagged = rows.filter((r) => r.hidden || r.reports > 0).length;

  return (
    <>
      <h1 className="a-title">Reviews</h1>
      <p className="a-muted" style={{ marginTop: -6 }}>
        Viewers who have watched a film can rate it (1–5 stars) and write a review. A review reported by 3 viewers is hidden automatically.
        Hidden and reported reviews are listed first{flagged ? ` (${flagged} need a look)` : ''}.
      </p>
      <section className="a-card">
        {!rows.length ? (
          <p className="a-muted">No reviews yet.</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Review</th><th>Film</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ maxWidth: 420 }}>
                      <b>{r.author}</b> <span style={{ color: '#f5c518' }}>{'★'.repeat(r.stars)}</span><span style={{ opacity: .3 }}>{'★'.repeat(5 - r.stars)}</span>
                      {r.body ? <small style={{ whiteSpace: 'pre-wrap' }}>{r.body}</small> : <small className="a-muted">(stars only)</small>}
                      <small className="a-muted">{timeAgo(r.created_at)}</small>
                    </td>
                    <td><Link href={`/title/${r.slug}`}>{r.title}</Link></td>
                    <td>
                      <span className={`a-badge ${r.hidden ? 'muted' : 'ok'}`}>{r.hidden ? 'Hidden' : 'Showing'}</span>
                      {r.reports > 0 && <small>{r.reports} report{r.reports === 1 ? '' : 's'}</small>}
                    </td>
                    <td>
                      <div className="a-row">
                        <form action={setReviewHidden.bind(null, r.id, !r.hidden)}>
                          <button className="btn btn-gray btn-small">{r.hidden ? 'Show' : 'Hide'}</button>
                        </form>
                        <form action={deleteReview.bind(null, r.id)}>
                          <button className="btn btn-gray btn-small">Delete</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
