import type { Metadata } from 'next';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Sign in' };

type Props = { searchParams: Promise<{ mode?: string; next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const mode = sp.mode === 'signup' || sp.mode === 'reset' ? sp.mode : 'signin';
  const next = sp.next?.startsWith('/') && !sp.next.startsWith('//') ? sp.next : '/';
  return (
    <div className="auth-wrap">
      <div>
        {sp.error && (
          <div className="form-msg error" style={{ maxWidth: 400 }}>
            If you just confirmed your email, you&apos;re all set: sign in below. If you were resetting your password, request a new link.
          </div>
        )}
        <AuthForm mode={mode} next={next} />
      </div>
    </div>
  );
}
