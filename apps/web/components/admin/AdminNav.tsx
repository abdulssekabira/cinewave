'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/titles', label: 'Films' },
  { href: '/admin/rows', label: 'Home rows' },
  { href: '/admin/partners', label: 'Partners' },
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
