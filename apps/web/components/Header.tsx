import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

export async function Header() {
  const { user } = await getUser();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="CineWave home">
        Cine<span>Wave</span>
      </Link>
      <nav className="nav" aria-label="Main">
        <Link href="/">Home</Link>
        <Link href="/search">Browse</Link>
        {user && <Link href="/watchlist">My List</Link>}
        <Link href="/plans">Plans</Link>
      </nav>
      <div className="header-actions">
        {user ? (
          <>
            <Link href="/account" className="btn btn-ghost btn-small">Account</Link>
            <form action={signOut}>
              <button className="btn btn-ghost btn-small" type="submit">Sign out</button>
            </form>
          </>
        ) : (
          <Link href="/login" className="btn btn-primary btn-small">Sign in</Link>
        )}
      </div>
    </header>
  );
}
