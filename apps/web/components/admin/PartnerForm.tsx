'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addPartner, type FormState } from '@/app/admin/partners/actions';

export function PartnerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addPartner, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="a-card">
      <h2>Add partner</h2>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-field">
        <label htmlFor="p-name">Studio or rights holder *</label>
        <input id="p-name" name="name" className="input" required />
      </div>
      <div className="a-grid2 tight">
        <div className="a-field">
          <label htmlFor="p-contact">Contact person</label>
          <input id="p-contact" name="contact_name" className="input" />
        </div>
        <div className="a-field">
          <label htmlFor="p-email">Contact email</label>
          <input id="p-email" name="contact_email" type="email" className="input" />
        </div>
      </div>
      <div className="a-field">
        <label htmlFor="p-notes">Notes</label>
        <textarea id="p-notes" name="notes" className="input" rows={3} />
      </div>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Adding…' : 'Add partner'}</button>
    </form>
  );
}
