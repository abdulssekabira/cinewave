'use client';

import { useActionState } from 'react';
import { saveReferralSettings, type FormState } from '@/app/admin/plans/actions';

export function ReferralForm({ needed, days, times, stats }: { needed: string; days: string; times: string; stats: { joined: number; rewarded: number } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveReferralSettings, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-grid3">
        <div className="a-field">
          <label htmlFor="rf-n">Friends needed</label>
          <input id="rf-n" name="referral_needed" className="input" inputMode="numeric" defaultValue={needed} />
        </div>
        <div className="a-field">
          <label htmlFor="rf-d">Free Standard (days)</label>
          <input id="rf-d" name="referral_days" className="input" inputMode="numeric" defaultValue={days} />
        </div>
        <div className="a-field">
          <label htmlFor="rf-t">Times per account</label>
          <input id="rf-t" name="referral_max_rewards" className="input" inputMode="numeric" defaultValue={times} />
          <small className="a-hint">1 = once only. 0 turns rewards off.</small>
        </div>
      </div>
      <p className="a-muted" style={{ margin: '4px 0 12px' }}>
        So far: {stats.joined} people joined with an invite · {stats.rewarded} accounts earned the reward.
      </p>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
