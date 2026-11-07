'use client';

import { useActionState } from 'react';
import { saveContactSettings, type FormState } from '@/app/admin/plans/actions';

export function ContactForm({ email, phone, whatsapp }: { email: string; phone: string; whatsapp: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveContactSettings, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="a-grid3">
        <div className="a-field">
          <label htmlFor="ct-e">Support email</label>
          <input id="ct-e" name="contact_email" type="email" className="input" defaultValue={email} placeholder="support@…" />
        </div>
        <div className="a-field">
          <label htmlFor="ct-p">Phone</label>
          <input id="ct-p" name="contact_phone" className="input" defaultValue={phone} placeholder="+256 7…" />
        </div>
        <div className="a-field">
          <label htmlFor="ct-w">WhatsApp</label>
          <input id="ct-w" name="contact_whatsapp" className="input" defaultValue={whatsapp} placeholder="+256 7…" />
        </div>
      </div>
      <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
