'use client';

import { useActionState } from 'react';
import { savePlan, type FormState } from '@/app/admin/plans/actions';
import type { Plan } from '@cinewave/shared';

export function PlanForm({ plan, subscribers }: { plan: Plan; subscribers: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePlan, {});
  const free = plan.id === 'free';
  const k = (s: string) => `${plan.id}-${s}`;

  return (
    <form action={action} className="a-card">
      <input type="hidden" name="id" value={plan.id} />
      <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{plan.name}</h2>
        <span className={`a-badge ${plan.active === false ? 'muted' : 'ok'}`}>
          {plan.active === false ? 'Hidden' : 'On sale'} · {subscribers} active
        </span>
      </div>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}

      <div className="a-field">
        <label htmlFor={k('name')}>Name</label>
        <input id={k('name')} name="name" className="input" defaultValue={plan.name} required />
      </div>

      {free ? (
        <p className="a-muted" style={{ marginTop: 0 }}>The Free plan is always free and always available.</p>
      ) : (
        <div className="a-grid2 tight">
          <div className="a-field">
            <label htmlFor={k('price')}>Monthly price (UGX)</label>
            <input id={k('price')} name="price" className="input" inputMode="numeric" defaultValue={plan.price_cents || ''} placeholder="e.g. 10000" />
          </div>
          <div className="a-field">
            <label htmlFor={k('weekly')}>Weekly price (UGX)</label>
            <input id={k('weekly')} name="weekly_price" className="input" inputMode="numeric" defaultValue={plan.weekly_price_cents ?? ''} placeholder="Leave empty for no weekly option" />
          </div>
        </div>
      )}

      <div className="a-field">
        <label htmlFor={k('desc')}>Short description</label>
        <input id={k('desc')} name="description" className="input" defaultValue={plan.description ?? ''} placeholder="e.g. Best for families" />
      </div>

      <div className="a-grid2 tight">
        <div className="a-field">
          <label htmlFor={k('q')}>Best video quality</label>
          <select id={k('q')} name="max_quality" className="select input" defaultValue={plan.max_quality}>
            <option value="480p">480p (saves the most data)</option>
            <option value="720p">720p (HD)</option>
            <option value="1080p">1080p (Full HD)</option>
          </select>
        </div>
        <div className="a-field">
          <label htmlFor={k('s')}>Devices allowed</label>
          <input id={k('s')} name="max_devices" type="number" min={1} max={20} className="input" defaultValue={plan.max_devices ?? ''} placeholder="No limit" />
        </div>
      </div>

      <div className="a-checks">
        <label className="a-check"><input type="checkbox" name="shows_ads" defaultChecked={plan.shows_ads} /> Shows ads</label>
        <label className="a-check"><input type="checkbox" name="downloads_allowed" defaultChecked={plan.downloads_allowed} /> Offline downloads</label>
        {!free && (
          <label className="a-check"><input type="checkbox" name="active" defaultChecked={plan.active !== false} /> On sale (shown on Plans page)</label>
        )}
      </div>

      <div className="a-field">
        <label htmlFor={k('f')}>Extra selling points (one per line, optional)</label>
        <textarea id={k('f')} name="features" className="input" rows={3} defaultValue={(plan.features ?? []).join('\n')} placeholder={'New Ugandan films every week\nWatch on phone, laptop or TV'} />
      </div>

      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : `Save ${plan.name}`}</button>
    </form>
  );
}
