import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getSignupPromo } from '@cinewave/shared';
import { AuthForm } from '@/components/AuthForm';
import { HelpLine } from '@/components/HelpLine';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Sign in' };

type Props = { searchParams: Promise<{ mode?: string; next?: string; error?: string; ref?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode = sp.mode === 'signup' || sp.mode === 'reset' ? sp.mode : 'signin';
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  const refCode = (sp.ref ?? (await cookies()).get('gle_ref')?.value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || undefined;
  const promo = mode === 'signup' ? await getSignupPromo(await createClient()).catch(() => null) : null;
  return (
    <div className="auth-wrap">
      <div>
        {promo && (
          <div className="promo-banner" role="note">
            <b>🎉 Welcome offer</b>
            <span>Sign up today and get <strong>{promo.days} days of {promo.planName}</strong> free on up to {promo.devices} devices. No payment needed.</span>
          </div>
        )}
        {sp.error && (
          <div className="form-msg error" style={{ maxWidth: 400 }}>
            If you just confirmed your email, you&apos;re all set: sign in below. If you were resetting your password, request a new link.
          </div>
        )}
        <AuthForm mode={mode} next={next} refCode={refCode} />
        <HelpLine title={mode === 'signup' ? 'Having trouble signing up?' : 'Having trouble signing in?'} topic={mode === 'signup' ? 'signing up' : 'signing in'} />
      </div>
    </div>
  );
}
