import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getNotifications, markNotifications } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export default async function NotificationsPage() {
  const { sb, user } = await getUser();
  if (!user) redirect('/login?next=/notifications');
  const list = await getNotifications(sb);
  // Opening this page marks everything read (the red dot goes away).
  if (list.some((n) => !n.read_at)) await markNotifications(sb, { read: true });

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 className="page-title">Notifications</h1>
      {list.length === 0 ? (
        <div className="empty">
          <h2>Nothing new yet</h2>
          <p>Add series to My List or start watching one, and we’ll tell you here when a new episode comes out.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? '/'} className={`notif${n.read_at ? '' : ' unread'}`}>
                {n.image_url ? <img src={n.image_url} alt="" loading="lazy" /> : <span className="notif-img" />}
                <div>
                  <b>{n.heading}</b>
                  {n.body && <p>{n.body}</p>}
                  <small>{ago(n.created_at)}</small>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
