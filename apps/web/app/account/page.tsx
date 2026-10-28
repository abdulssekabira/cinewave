import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveSubscription, getProfile, PLAN_LABEL } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/ProfileForm';
import { signOut } from '@/app/login/actions';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const { sb, user } = await getUser();
  if (!user) redirect('/login?next=/account');
  const [profile, sub, staff] = await Promise.all([
    getProfile(sb, user.id),
    getActiveSubscription(sb),
    sb.rpc('is_staff').then((r) => Boolean(r.data)),
  ]);

  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="page">
      <h1 className="page-title">Account</h1>
      {staff && (
        <Link href="/admin" className="btn btn-accent btn-small" style={{ marginBottom: 20 }}>Open admin dashboard</Link>
      )}

      <section className="panel">
        <h2>Membership</h2>
        <dl className="kv">
          <dt>Plan</dt>
          <dd>{sub ? PLAN_LABEL[sub.plan_id] : 'Free (with ads)'}</dd>
          {sub && (
            <>
              <dt>Status</dt>
              <dd style={{ textTransform: 'capitalize' }}>{sub.status.replace('_', ' ')}</dd>
              {renews && (
                <>
                  <dt>{sub.cancel_at_period_end || sub.provider === 'pesapal' || sub.provider === 'manual' ? 'Active until' : 'Renews on'}</dt>
                  <dd>{renews}</dd>
                </>
              )}
            </>
          )}
        </dl>
        <Link href="/plans" className="btn btn-gray btn-small" style={{ marginTop: 16 }}>
          {sub ? 'Add time or change plan' : 'See plans'}
        </Link>
      </section>

      <section className="panel">
        <h2>Profile</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 0 }}>{user.email}</p>
        <ProfileForm name={profile?.display_name ?? ''} country={profile?.country_code ?? ''} />
      </section>

      <section className="panel">
        <h2>Security & privacy</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/account/password" className="btn btn-gray btn-small">Change password</Link>
          <Link href="/watchlist" className="btn btn-gray btn-small">My List</Link>
          <form action={signOut}>
            <button type="submit" className="btn btn-gray btn-small">Sign out</button>
          </form>
        </div>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 0 }}>
          Account deletion requests will be available here before launch.
        </p>
      </section>
    </div>
  );
}
