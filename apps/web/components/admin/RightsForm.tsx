'use client';

import { useActionState, useState } from 'react';
import { addRights, type FormState } from '@/app/admin/titles/actions';
import type { Partner } from '@/lib/admin';

export function RightsForm({ titleId, partners, today }: { titleId: string; partners: Partner[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addRights.bind(null, titleId), {});
  const [scope, setScope] = useState<'worldwide' | 'countries'>('worldwide');
  const [download, setDownload] = useState(false);

  return (
    <form action={action} className="a-rights-form">
      <h3>Add a rights window</h3>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}

      <div className="a-grid2 tight">
        <div className="a-field">
          <label htmlFor="r-partner">Partner</label>
          <select id="r-partner" name="partner_id" className="select" defaultValue="">
            <option value="">— None / own content —</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="a-field">
          <label htmlFor="r-contract">Contract reference *</label>
          <input id="r-contract" name="contract_ref" className="input" required placeholder="e.g. CW-2026-014" />
        </div>
      </div>

      <fieldset className="a-field">
        <legend>Where it can be watched</legend>
        <div className="a-radios">
          <label className="a-check">
            <input type="radio" name="scope" value="worldwide" checked={scope === 'worldwide'} onChange={() => setScope('worldwide')} />
            Worldwide
          </label>
          <label className="a-check">
            <input type="radio" name="scope" value="countries" checked={scope === 'countries'} onChange={() => setScope('countries')} />
            Only these countries
          </label>
        </div>
        {scope === 'countries' && (
          <input name="countries" className="input" placeholder="UG, KE, RW" aria-label="Country codes" defaultValue="UG" />
        )}
      </fieldset>

      <div className="a-grid2 tight">
        <div className="a-field">
          <label htmlFor="r-start">Starts *</label>
          <input id="r-start" name="starts_on" type="date" className="input" required defaultValue={today} />
        </div>
        <div className="a-field">
          <label htmlFor="r-end">Ends</label>
          <input id="r-end" name="ends_on" type="date" className="input" />
          <small className="a-hint">Leave empty if the licence has no end date.</small>
        </div>
      </div>

      <div className="a-checks">
        <label className="a-check"><input type="checkbox" name="allow_ads" defaultChecked /> Ads allowed</label>
        <label className="a-check">
          <input type="checkbox" name="allow_download" checked={download} onChange={(e) => setDownload(e.target.checked)} />
          Offline downloads allowed
        </label>
      </div>
      {download && (
        <div className="a-field" style={{ maxWidth: 260 }}>
          <label htmlFor="r-exp">Downloads expire after (hours)</label>
          <input id="r-exp" name="download_expiry_hours" className="input" inputMode="numeric" defaultValue={48} />
        </div>
      )}

      <div className="a-field">
        <label htmlFor="r-notes">Notes</label>
        <input id="r-notes" name="notes" className="input" placeholder="Anything worth remembering about this agreement" />
      </div>

      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Adding…' : 'Add rights window'}</button>
    </form>
  );
}
