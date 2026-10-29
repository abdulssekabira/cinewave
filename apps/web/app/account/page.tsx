import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveSubscription, getProfile, PLAN_LABEL } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/ProfileForm';
import { signOut } from '@/app/login/actions';
import { removeDevice } from './actions';
import { deviceName, type Device } from '@/lib/devices';
import { TZ } from '@/lib/admin';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const { sb, user } = await getUser();
  if (!user) redirect('/login?next=/account');
  const [profile, sub, staff, devRes, planRes, unameRes] = await Promise.all([
    getProfile(sb, user.id),
    getActiveSubscription(sb),
    sb.rpc('is_staff').then((r) => Boolean(r.data)),
    sb.rpc('my_devices'),
    sb.rpc('current_plan').then(async (r) => (await sb.from('plans').select('name, max_devices').eq('id', r.data ?? 'free').maybeSingle()).data),
    sb.from('profiles').select('username').eq('id', user.id).maybeSingle(),
  ]);
  // Staff are never limited (they test on many devices).
  const devices = ((devRes.data ?? []) as Device[]).map((d) => (staff ? { ...d, allowed: true } : d));
  const limit = (planRes?.max_devices as number | null | undefined) ?? null;
  const blocked = devices.some((d) => d.is_current && !d.allowed);
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });

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
        <ProfileForm name={profile?.display_name ?? ''} country={profile?.country_code ?? ''} username={unameRes.data?.username ?? ''} />
      </section>

      <section className="panel" id="devices">
        <h2>Devices</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 0 }}>
          {limit
            ? <>Your {planRes?.name} plan works on up to <b>{limit} devices</b>. You’re using <b>{Math.min(devices.length, 99)}</b>.</>
            : <>Phones, computers and apps signed in to your account.</>}
          {staff && limit ? <> As staff, you’re not limited.</> : null}
        </p>
        {blocked && (
          <div className="form-msg error" role="alert">
            This device can’t play films because your account is on too many devices. Remove one you no longer use.
          </div>
        )}
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.session_id} className={d.allowed ? '' : 'over'}>
              <div style={{ minWidth: 0 }}>
                <b>{deviceName(d.user_agent)}</b>
                {d.is_current && <span className="device-tag">This device</span>}
                {!d.allowed && <span className="device-tag warn">Can’t play</span>}
                <small>Signed in {when(d.signed_in_at)} · last used {when(d.last_active)}</small>
              </div>
              {!d.is_current && (
                <form action={removeDevice.bind(null, d.session_id)}>
                  <button className="btn btn-gray btn-small" type="submit">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 0 }}>
          Removing a device signs it out. Devices not used for 30 days are removed automatically.
        </p>
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
