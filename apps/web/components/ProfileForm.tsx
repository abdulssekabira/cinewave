'use client';

import { useActionState } from 'react';
import { updateProfile, type ProfileState } from '@/app/account/actions';

export function ProfileForm({ name, country }: { name: string; country: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="field">
        <label htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" className="input" defaultValue={name} maxLength={60} />
      </div>
      <div className="field">
        <label htmlFor="country">Country (2-letter code)</label>
        <input
          id="country"
          name="country"
          className="input"
          defaultValue={country}
          maxLength={2}
          placeholder="AE"
          style={{ textTransform: 'uppercase', maxWidth: 120 }}
        />
      </div>
      <button className="btn btn-primary btn-small" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
