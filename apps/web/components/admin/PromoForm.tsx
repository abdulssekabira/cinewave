'use client';

import { useActionState } from 'react';
import { savePromoSettings, type FormState } from '@/app/admin/plans/actions';

export function PromoForm({ on, plan, days, plans, given }: { on: boolean; plan: string; days: string; plans: { id: string; name: string }[]; given: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePromoSettings, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <label className="a-check" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="checkbox" name="signup_promo_on" defaultChecked={on} /> <b>Give every new account a free plan</b>
      </label>
      <div className="a-grid3">
        <div className="a-field">
          <label htmlFor="pf-p">Plan</label>
          <select id="pf-p" name="signup_promo_plan" className="input" defaultValue={plan}>
            {plans.filter((p) => p.id !== 'free').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="pf-d">For how many days</label>
          <input id="pf-d" name="signup_promo_days" className="input" inputMode="numeric" defaultValue={days} />
        </div>
      </div>
      <p className="a-muted" style={{ margin: '4px 0 12px' }}>
        Given once per account, when they confirm their email (or straight away with Google sign-in). After the days end they go back to Free automatically.
        So far: {given} account{given === 1 ? '' : 's'} got it.
      </p>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
