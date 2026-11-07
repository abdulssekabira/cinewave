import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { HeaderShell, NavLinks } from './HeaderShell';
import { getUnreadCount } from '@cinewave/shared';
import { BellIcon, SearchIcon, UserIcon } from './Icons';

export async function Header() {
  const { sb, user } = await getUser();
  const [staff, unread] = user
    ? await Promise.all([sb.rpc('is_staff').then((r) => Boolean(r.data)), getUnreadCount(sb).catch(() => 0)])
    : [false, 0];
  return (
    <HeaderShell>
      <Link href="/" className="wordmark" aria-label="GLE Movies home">GLE<span>MOVIES</span></Link>
      <NavLinks signedIn={Boolean(user)} />
      <div className="header-actions">
        <Link href="/search" className="icon-btn" aria-label="Search">
          <SearchIcon size={20} />
        </Link>
        {user && (
          <Link href="/notifications" className="icon-btn bell" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}>
            <BellIcon size={20} />
            {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        )}
        {staff && <Link href="/admin" className="admin-link">Admin</Link>}
        {user ? (
          <Link href="/account" className="avatar" aria-label="Account">
            <UserIcon size={18} />
          </Link>
        ) : (
          <Link href="/login" className="signin-link">Sign in</Link>
        )}
      </div>
    </HeaderShell>
  );
}
