import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { HeaderShell, NavLinks } from './HeaderShell';
import { SearchIcon, UserIcon } from './Icons';

export async function Header() {
  const { user } = await getUser();
  return (
    <HeaderShell>
      <Link href="/" className="wordmark" aria-label="CineWave home">CINEWAVE</Link>
      <NavLinks signedIn={Boolean(user)} />
      <div className="header-actions">
        <Link href="/search" className="icon-btn" aria-label="Search">
          <SearchIcon size={20} />
        </Link>
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
