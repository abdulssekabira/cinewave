'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { badgeText } from '@cinewave/shared';
import { useChatUnread } from '@/lib/chat-unread';

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

function Links({ signedIn, userId }: { signedIn: boolean; userId: string | null }) {
  const path = usePathname();
  const unread = useChatUnread(userId, path === '/chat');
  const sp = useSearchParams();
  const sort = sp.get('sort');
  const items = [
    { href: '/', label: 'Home', active: path === '/' },
    { href: '/search', label: 'Movies', active: path === '/search' && sort !== 'newest' },
    { href: '/search?sort=newest', label: 'New & Popular', active: path === '/search' && sort === 'newest' },
    ...(signedIn ? [{ href: '/watchlist', label: 'My List', active: path === '/watchlist' }] : []),
    { href: '/chat', label: 'Chat', active: path === '/chat' },
  ];
  return (
    <>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={i.active ? 'active' : undefined}
          aria-current={i.active ? 'page' : undefined}
        >
          {i.label}
          {i.href === '/chat' && unread > 0 && <span className="nav-badge" aria-label={`${unread} new messages`}>{badgeText(unread)}</span>}
        </Link>
      ))}
    </>
  );
}

export function NavLinks({ signedIn, userId = null }: { signedIn: boolean; userId?: string | null }) {
  return (
    <nav className="nav" aria-label="Main">
      <Suspense fallback={null}>
        <Links signedIn={signedIn} userId={userId} />
      </Suspense>
    </nav>
  );
}
