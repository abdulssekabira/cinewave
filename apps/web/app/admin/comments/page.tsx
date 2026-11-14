import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clockLabel, timeAgo } from '@cinewave/shared';
import { requireStaff } from '@/lib/admin';
import { deleteComment, setCommentHidden } from './actions';

export const metadata: Metadata = { title: 'Scene comments' };

type Row = { id: string; title: string; slug: string; episode: string | null; parent_id: string | null; author: string; at_seconds: number; body: string; hidden: boolean; reports: number; created_at: string };

export default async function CommentsAdmin() {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) notFound();
  const { data } = await sb.rpc('admin_timed_comments', { lim: 300 });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <h1 className="a-title">Scene comments</h1>
      <p className="a-muted" style={{ marginTop: -6 }}>
        Comments viewers pinned to a moment of a film or episode, and their replies. 3 reports hide one automatically. Hidden and reported ones are listed first.
      </p>
      <section className="a-card">
        {!rows.length ? <p className="a-muted">No scene comments yet.</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Comment</th><th>Where</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ maxWidth: 420 }}>
                      <b>{r.author}</b>{r.parent_id ? <span className="a-muted"> (reply)</span> : null}
                      <small style={{ whiteSpace: 'pre-wrap' }}>{r.body}</small>
                      <small className="a-muted">{timeAgo(r.created_at)}</small>
                    </td>
                    <td>
                      <Link href={`/title/${r.slug}`}>{r.title}</Link>
                      <small>{r.episode ? `${r.episode} · ` : ''}at {clockLabel(r.at_seconds)}</small>
                    </td>
                    <td>
                      <span className={`a-badge ${r.hidden ? 'muted' : 'ok'}`}>{r.hidden ? 'Hidden' : 'Showing'}</span>
                      {r.reports > 0 && <small>{r.reports} report{r.reports === 1 ? '' : 's'}</small>}
                    </td>
                    <td>
                      <div className="a-row">
                        <form action={setCommentHidden.bind(null, r.id, !r.hidden)}><button className="btn btn-gray btn-small">{r.hidden ? 'Show' : 'Hide'}</button></form>
                        <form action={deleteComment.bind(null, r.id)}><button className="btn btn-gray btn-small">Delete</button></form>
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
