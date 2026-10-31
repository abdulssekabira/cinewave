'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset, signIn, signUp, type AuthState } from '@/app/login/actions';
import { PasswordInput } from './PasswordInput';

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
          <>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" className="input" autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username" name="username" className="input" required minLength={3} maxLength={20}
                autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                pattern="[A-Za-z0-9_.]{3,20}" placeholder="e.g. abdul_ug"
              />
              <small className="field-hint">You can sign in with this or your email. Letters, numbers, dots and underscores.</small>
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="email">{mode === 'signin' ? 'Email or username' : 'Email'}</label>
          {mode === 'signin' ? (
            <input id="email" name="email" type="text" required className="input" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          ) : (
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          )}
        </div>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={mode === 'signup' ? 8 : undefined}
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
