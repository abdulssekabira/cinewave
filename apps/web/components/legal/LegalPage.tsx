import Link from 'next/link';
import type { ReactNode } from 'react';
import { ADDRESS, BRAND, COMPANY, LEGAL_UPDATED, type Contact } from '@/lib/site';

const PAGES = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refunds', label: 'Refunds' },
  { href: '/copyright', label: 'Copyright' },
  { href: '/contact', label: 'Contact' },
];

export function LegalPage({ title, current, children }: { title: string; current: string; children: ReactNode }) {
  return (
    <div className="page legal">
      <nav className="legal-nav" aria-label="Policies">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} aria-current={p.href === current ? 'page' : undefined}>{p.label}</Link>
        ))}
      </nav>
      <h1 className="page-title">{title}</h1>
      <p className="legal-updated">Last updated {LEGAL_UPDATED}</p>
      <div className="legal-body">{children}</div>
    </div>
  );
}

/** How to reach GLE Movies, from the details the owner set in the admin. */
export function ContactLines({ c }: { c: Contact }) {
  return (
    <ul>
      <li><b>{BRAND}</b>, operated by <b>{COMPANY}</b>, {ADDRESS}.</li>
      {c.email && <li>Email: <a href={`mailto:${c.email}`}>{c.email}</a></li>}
      {c.phone && <li>Phone: <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a></li>}
      {c.whatsapp && <li>WhatsApp: <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{c.whatsapp}</a></li>}
      {!c.email && !c.phone && !c.whatsapp && <li>Contact details will be published here shortly.</li>}
    </ul>
  );
}
