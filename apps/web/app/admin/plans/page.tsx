import { notFound } from 'next/navigation';
import type { Plan } from '@cinewave/shared';
import { fmtDateTime, requireStaff } from '@/lib/admin';
import { ensureServerSecret } from '@/lib/server-secret';
import { pesapalSandbox } from '@/lib/pesapal';
import { formatPrice } from '@cinewave/shared';
import { PlanForm } from '@/components/admin/PlanForm';
import { AppLinkForm } from '@/components/admin/AppLinkForm';

export default async function AdminPlans() {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) notFound();
  const [{ data: p }, { data: subs }, { data: pays }, ready, { data: settings }] = await Promise.all([
    sb.from('plans').select('*').order('rank'),
    sb.from('subscriptions').select('plan_id').eq('status', 'active'),
    sb.from('payments').select('merchant_ref, plan_id, period, amount, currency, status, method, sandbox, created_at')
      .order('created_at', { ascending: false }).limit(25),
    ensureServerSecret(sb),
    sb.from('site_settings').select('key, value'),
  ]);
  const setting = (k: string) => (settings ?? []).find((r) => r.key === k)?.value ?? '';
  const sandbox = pesapalSandbox();
  const plans = (p ?? []) as Plan[];
  const count = (id: string) => (subs ?? []).filter((s) => s.plan_id === id).length;

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Plans &amp; prices</h1>
          <p className="a-muted" style={{ margin: '4px 0 0' }}>
            Changes show on the website straight away. People who already paid keep what they paid for until their period ends.
          </p>
        </div>
      </div>
      <div className="a-plan-grid">
        {plans.map((plan) => <PlanForm key={plan.id} plan={plan} subscribers={count(plan.id)} />)}
      </div>
      <section className="a-card" style={{ marginTop: 24 }} id="app">
        <h2>Android app download</h2>
        <p className="a-muted" style={{ marginTop: -4 }}>
          Share <b>glemovies.com/app</b>. It gives people this file and shows how to install it.
        </p>
        <AppLinkForm url={setting('android_apk_url')} version={setting('android_version')} note={setting('android_note')} />
      </section>
      <section className="a-card" style={{ marginTop: 24 }}>
        <div className="a-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Payments</h2>
          <span className={`a-badge ${!ready ? 'warn' : sandbox ? 'muted' : 'ok'}`}>
            {!ready ? 'Not ready' : sandbox ? 'Test mode (no real money)' : 'Live'}
          </span>
        </div>
        {!ready && <p className="a-muted">Payments need the server keys in Vercel. Ask for help setting this up.</p>}
        {(pays ?? []).length === 0 ? (
          <p className="a-muted">No payments yet.</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Reference</th><th>Plan</th><th>Amount</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {(pays ?? []).map((x) => (
                  <tr key={x.merchant_ref}>
                    <td><b>{x.merchant_ref}</b>{x.sandbox && <small>test</small>}</td>
                    <td>{x.plan_id} · 1 {x.period}</td>
                    <td>{formatPrice(x.amount, x.currency)}<small>{x.method ?? ''}</small></td>
                    <td><span className={`a-badge ${x.status === 'completed' ? 'ok' : x.status === 'pending' ? 'muted' : 'warn'}`}>{x.status}</span></td>
                    <td className="a-muted">{fmtDateTime(x.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="a-muted" style={{ marginTop: 16 }}>
        Which films each plan unlocks is set per film (Films → “Who can watch”). A higher plan always includes everything below it.
      </p>
    </>
  );
}
