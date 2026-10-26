'use client';

import { useActionState } from 'react';
import { updatePassword, type AuthState } from '@/app/login/actions';

export default function PasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>New password</h1>
        <p>Choose a password with at least 8 characters.</p>
        {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
        {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
        <form action={action}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input id="password" name="password" type="password" minLength={8} required className="input" autoComplete="new-password" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
            {pending ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
