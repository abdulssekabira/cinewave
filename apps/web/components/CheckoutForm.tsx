'use client';

import { useActionState, useState } from 'react';
import { checkout, type CheckoutState } from '@/app/checkout/actions';

export function CheckoutForm({
  planId, options, initial, email,
}: {
  planId: string;
  options: { value: string; label: string; price: string }[];
  initial: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkout, {});
  const [period, setPeriod] = useState(initial);
  const chosen = options.find((o) => o.value === period) ?? options[0];

  return (
    <form action={action} className="panel" style={{ display: 'grid', gap: 16 }}>
      <input type="hidden" name="plan" value={planId} />
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        <legend style={{ fontWeight: 600, marginBottom: 8 }}>How long?</legend>
        {options.map((o) => (
          <label key={o.value} className={`period-opt${period === o.value ? ' on' : ''}`}>
            <input type="radio" name="period" value={o.value} checked={period === o.value} onChange={() => setPeriod(o.value)} />
            <span>{o.label}</span>
            <b>{o.price}</b>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="co-phone">Mobile money number (optional)</label>
        <input id="co-phone" name="phone" className="input" inputMode="tel" placeholder="e.g. 0772 123456" autoComplete="tel" />
      </div>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>Receipt goes to <b>{email}</b>.</p>
      <button className="btn btn-accent" disabled={pending}>{pending ? 'Opening payment…' : `Pay ${chosen.price}`}</button>
    </form>
  );
}
