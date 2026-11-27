'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Overview', exact: true, adminOnly: true },
  { href: '/admin/titles', label: 'Films' },
  { href: '/admin/categories', label: 'VJs & genres', adminOnly: true },
  { href: '/admin/rows', label: 'Home rows', adminOnly: true },
  { href: '/admin/partners', label: 'Partners', adminOnly: true },
  { href: '/admin/plans', label: 'Plans', adminOnly: true },
  { href: '/admin/ads', label: 'Adverts', adminOnly: true },
  { href: '/admin/reviews', label: 'Reviews', adminOnly: true },
  { href: '/admin/chat', label: 'Chat', adminOnly: true },
  { href: '/admin/comments', label: 'Comments', adminOnly: true },
  { href: '/admin/users', label: 'Users', adminOnly: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {ITEMS.filter((i) => isAdmin || !i.adminOnly).map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            {i.label}
          </Link>
        );
      })}
      <Link href="/" className="admin-nav-site">View site ↗</Link>
    </nav>
  );
}
