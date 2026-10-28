import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrice, getPlans, type Plan } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Plans' };

function features(p: Plan): string[] {
  const f: string[] = [];
  f.push(p.id === 'free' ? 'Selected free films' : p.id === 'premium' ? 'Full catalogue incl. Premium' : 'Free + Standard catalogue');
  f.push(p.shows_ads ? 'With ads' : 'No ads');
  f.push(`Up to ${p.max_quality}`);
  f.push(`${p.max_streams} screen${p.max_streams > 1 ? 's' : ''} at a time`);
  if (p.downloads_allowed) f.push('Offline downloads (Android)');
  return [...f, ...(p.features ?? [])];
}

export default async function PlansPage() {
  const { sb, user } = await getUser();
  const [plans, planRes] = await Promise.all([
    getPlans(sb),
    sb.rpc('current_plan'),
  ]);
  const current = user ? (planRes.data as string | null) : null;

  return (
    <div className="page">
      <h1 className="page-title">Choose your plan</h1>
      <div className="plan-grid">
        {plans.map((p) => (
          <article key={p.id} className={`plan${current === p.id ? ' current' : ''}`}>
            <h3>{p.name}</h3>
            {p.description && <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '-4px 0 8px' }}>{p.description}</p>}
            <div className="price">
              {p.price_cents > 0 || !p.weekly_price_cents ? (
                <>{formatPrice(p.price_cents, p.currency)}{p.price_cents > 0 && <small> / month</small>}</>
              ) : (
                <>{formatPrice(p.weekly_price_cents, p.currency)}<small> / week</small></>
              )}
            </div>
            {p.price_cents > 0 && Boolean(p.weekly_price_cents || p.annual_price_cents) && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -8 }}>
                {p.weekly_price_cents ? <>or {formatPrice(p.weekly_price_cents, p.currency)} / week</> : null}
                {p.weekly_price_cents && p.annual_price_cents ? ' · ' : null}
                {p.annual_price_cents ? <>{formatPrice(p.annual_price_cents, p.currency)} / year</> : null}
              </div>
            )}
            <ul>{features(p).map((f) => <li key={f}>{f}</li>)}</ul>
            <div style={{ marginTop: 'auto' }}>
              {p.id === 'free' ? (
                current === 'free' ? <button className="btn btn-gray" disabled style={{ width: '100%' }}>Current plan</button> : null
              ) : (
                <Link
                  href={user ? `/checkout/${p.id}` : `/login?next=/checkout/${p.id}`}
                  className={`btn ${current === p.id ? 'btn-gray' : 'btn-accent'}`}
                  style={{ width: '100%' }}
                >
                  {current === p.id ? 'Current plan · add more time' : 'Subscribe'}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 20 }}>
        Pay with MTN Mobile Money, Airtel Money or Visa/Mastercard.
      </p>
    </div>
  );
}
