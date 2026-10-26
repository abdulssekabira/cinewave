'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, signIn, signUp, type AuthState } from '@/app/login/actions';

type Mode = 'signin' | 'signup' | 'reset';

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  signin: { title: 'Welcome back', sub: 'Sign in to sync your list and progress.', cta: 'Sign in' },
  signup: { title: 'Create account', sub: 'Free to join. Watch free titles with ads.', cta: 'Create account' },
  reset: { title: 'Reset password', sub: 'We’ll email you a reset link.', cta: 'Send reset link' },
};

const ACTIONS = { signin: signIn, signup: signUp, reset: requestPasswordReset };

export function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(ACTIONS[mode], {});
  const c = COPY[mode];
  const q = next !== '/' ? `&next=${encodeURIComponent(next)}` : '';

  return (
    <div className="auth-card">
      <h1>{c.title}</h1>
      <p>{c.sub}</p>
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
      {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" className="input" autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
              className="input"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>
        )}
        <button className="btn btn-accent" style={{ width: '100%' }} disabled={pending}>
          {pending ? 'Please wait…' : c.cta}
        </button>
      </form>
      <div className="auth-switch">
        {mode === 'signin' && (
          <>
            New here? <Link href={`/login?mode=signup${q}`}>Create an account</Link>
            <br />
            <Link href="/login?mode=reset">Forgot password?</Link>
          </>
        )}
        {mode !== 'signin' && (
          <>Have an account? <Link href={`/login?mode=signin${q}`}>Sign in</Link></>
        )}
      </div>
    </div>
  );
}
