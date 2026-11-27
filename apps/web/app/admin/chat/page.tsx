import type { Metadata } from 'next';
import Link from 'next/link';
import { timeAgo } from '@cinewave/shared';
import { requireAdmin } from '@/lib/admin';
import { banChatAction, deleteChatAction, unbanChatAction } from './actions';
import { ClearButton } from './ClearButton';

export const metadata: Metadata = { title: 'Chat' };

type Reported = { id: number; user_id: string | null; author: string; body: string; created_at: string; reports: number; deleted: boolean };
type Ban = { user_id: string; author: string; until: string | null; reason: string | null; created_at: string };

export default async function ChatAdmin() {
  const { sb } = await requireAdmin();
  const [{ count }, rep, bans] = await Promise.all([
    sb.from('chat_messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.rpc('admin_chat_reports'),
    sb.rpc('admin_chat_bans'),
  ]);
  const reported = (rep.data ?? []) as Reported[];
  const banned = (bans.data ?? []) as Ban[];

  return (
    <>
      <h1 className="a-title">Chat</h1>
      <p className="a-muted" style={{ marginTop: -6 }}>
        GLE Chat is one public room on the website and app. Anyone signed in can write; links and phone numbers are blocked
        and each person can send one message every 3 seconds. You can also delete messages and mute people straight from
        the <Link href="/chat">chat</Link> (tap ⋯ next to a message).
      </p>

      <section className="a-card">
        <h2>Clear the chat</h2>
        <p className="a-muted">Removes every message for everyone, at once. People who have the chat open see it empty straight away.</p>
        <ClearButton count={count ?? 0} />
      </section>

      <section className="a-card">
        <h2>Reported messages</h2>
        {!reported.length ? <p className="a-muted">Nothing reported.</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Message</th><th>Reports</th><th /></tr></thead>
              <tbody>
                {reported.map((m) => (
                  <tr key={m.id}>
                    <td style={{ maxWidth: 460 }}>
                      <b>{m.author}</b>
                      <small style={{ whiteSpace: 'pre-wrap' }}>{m.deleted ? <i className="a-muted">(deleted)</i> : m.body}</small>
                      <small className="a-muted">{timeAgo(m.created_at)}</small>
                    </td>
                    <td>{m.reports}</td>
                    <td>
                      <div className="a-row">
                        {!m.deleted && <form action={deleteChatAction.bind(null, m.id)}><button className="btn btn-gray btn-small">Delete</button></form>}
                        {m.user_id && <form action={banChatAction.bind(null, m.user_id, 7)}><button className="btn btn-gray btn-small">Mute 7 days</button></form>}
                        {m.user_id && <form action={banChatAction.bind(null, m.user_id, null)}><button className="btn btn-gray btn-small">Ban</button></form>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="a-card">
        <h2>Muted and banned</h2>
        {!banned.length ? <p className="a-muted">Nobody is muted.</p> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Viewer</th><th>Until</th><th /></tr></thead>
              <tbody>
                {banned.map((b) => (
                  <tr key={b.user_id}>
                    <td><b>{b.author}</b>{b.reason && <small className="a-muted">{b.reason}</small>}</td>
                    <td>{b.until ? new Date(b.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'For good'}</td>
                    <td><form action={unbanChatAction.bind(null, b.user_id)}><button className="btn btn-gray btn-small">Allow again</button></form></td>
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
