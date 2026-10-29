'use client';

import { useActionState } from 'react';
import { updateProfile, type ProfileState } from '@/app/account/actions';

export function ProfileForm({ name, country, username }: { name: string; country: string; username: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form action={action}>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username" name="username" className="input" defaultValue={username} minLength={3} maxLength={20}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} pattern="[A-Za-z0-9_.]{3,20}"
          placeholder="Choose a username to sign in with"
        />
        <small className="field-hint">Sign in with your username or your email.</small>
      </div>
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
          placeholder="UG"
          style={{ textTransform: 'uppercase', maxWidth: 120 }}
        />
      </div>
      <button className="btn btn-accent btn-small" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
