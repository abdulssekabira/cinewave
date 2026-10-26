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
            That link is invalid or has expired. Please try again.
          </div>
        )}
        <AuthForm mode={mode} next={next} />
      </div>
    </div>
  );
}
