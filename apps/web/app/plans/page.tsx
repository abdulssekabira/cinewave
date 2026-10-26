import type { Metadata } from 'next';
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
  return f;
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
            <div className="price">
              {formatPrice(p.price_cents, p.currency)}
              {p.price_cents > 0 && <small> / month</small>}
            </div>
            {p.annual_price_cents && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -8 }}>
                or {formatPrice(p.annual_price_cents, p.currency)} / year
              </div>
            )}
            <ul>{features(p).map((f) => <li key={f}>{f}</li>)}</ul>
            <div style={{ marginTop: 'auto' }}>
              {current === p.id ? (
                <button className="btn btn-ghost" disabled style={{ width: '100%' }}>Current plan</button>
              ) : p.id === 'free' ? null : (
                <button className="btn btn-primary" disabled style={{ width: '100%' }} title="Checkout arrives in Phase 4">
                  Subscribe — coming soon
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 20 }}>
        Prices are placeholders. Taxes, regional pricing and trial terms will be confirmed before launch.
      </p>
    </div>
  );
}
