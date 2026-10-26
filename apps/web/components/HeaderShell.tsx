'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

/** Transparent over the hero, solid once the page scrolls. */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <header className={`site-header${scrolled ? ' scrolled' : ''}`}>{children}</header>;
}

function Links({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const sort = sp.get('sort');
  const items = [
    { href: '/', label: 'Home', active: path === '/' },
    { href: '/search', label: 'Movies', active: path === '/search' && sort !== 'newest' },
    { href: '/search?sort=newest', label: 'New & Popular', active: path === '/search' && sort === 'newest', hideSm: true },
    ...(signedIn ? [{ href: '/watchlist', label: 'My List', active: path === '/watchlist' }] : []),
  ];
  return (
    <>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={[i.active ? 'active' : '', i.hideSm ? 'hide-sm' : ''].join(' ').trim() || undefined}
          aria-current={i.active ? 'page' : undefined}
        >
          {i.label}
        </Link>
      ))}
    </>
  );
}

export function NavLinks({ signedIn }: { signedIn: boolean }) {
  return (
    <nav className="nav" aria-label="Main">
      <Suspense fallback={null}>
        <Links signedIn={signedIn} />
      </Suspense>
    </nav>
  );
}
