import { PLAN_LABEL, type PlanId } from '@cinewave/shared';
import { fmtDate, requireStaff } from '@/lib/admin';
import { endComplimentary, grantComplimentary, setUploader } from './actions';

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  country_code: string | null;
  created_at: string | null;
  plan: PlanId;
  manual_subscription_id: string | null;
  manual_until: string | null;
  roles: string[];
  devices: number;
  device_limit: number | null;
  last_active: string | null;
};

type Props = { searchParams: Promise<{ q?: string; sort?: string }> };

export default async function Users({ searchParams }: Props) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) {
    return (
      <>
        <div className="a-head"><h1>Users</h1></div>
        <p className="a-muted">Only administrators can view users.</p>
      </>
    );
  }
  const { q, sort } = await searchParams;
  const { data, error } = await sb.rpc('admin_list_users', { search: q?.trim() || null });
  const users = (data ?? []) as UserRow[];
  if (sort === 'devices') users.sort((a, b) => b.devices - a.devices);
  const totalDevices = users.reduce((n, u) => n + u.devices, 0);
  const signedIn = users.filter((u) => u.devices > 0).length;
  const atLimit = users.filter((u) => u.device_limit != null && u.devices >= u.device_limit && u.devices > 0).length;

  return (
    <>
      <div className="a-head"><h1>Users</h1></div>
      <form className="a-filters" action="/admin/users">
        <input name="q" className="input" placeholder="Search by name or email…" defaultValue={q ?? ''} aria-label="Search users" />
        <select name="sort" className="select a-sm" defaultValue={sort ?? ''} aria-label="Sort">
          <option value="">Newest first</option>
          <option value="devices">Most devices first</option>
        </select>
        <button className="btn btn-gray btn-small">Show</button>
      </form>
      {!error && (
        <p className="a-muted">
          {users.length} users · <b>{totalDevices}</b> devices signed in · {signedIn} users signed in on at least one device
          {atLimit > 0 && <> · <span className="a-badge warn">{atLimit} at their device limit</span></>}
        </p>
      )}
      {error && <div className="form-msg error">{error.message}</div>}

      {users.length === 0 ? (
        <div className="empty"><h2>No users found</h2></div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>User</th><th>Country</th><th>Plan</th><th>Devices</th><th>Joined</th><th>Complimentary access</th><th>Uploader</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <b>{u.display_name ?? '—'}</b>
                    <small>{u.email}</small>
                    {u.roles.length > 0 && (
                      <small><span className="a-badge ok">{u.roles.map((r) => (r === 'editor' ? 'uploader' : r)).join(', ')}</span></small>
                    )}
                  </td>
                  <td>{u.country_code ?? '—'}</td>
                  <td><span className={`a-badge ${u.plan === 'free' ? 'muted' : 'ok'}`}>{PLAN_LABEL[u.plan]}</span></td>
                  <td>
                    <span
                      className={`a-badge ${u.devices === 0 ? 'muted' : u.device_limit != null && u.devices > u.device_limit ? 'bad' : u.device_limit != null && u.devices >= u.device_limit ? 'warn' : 'ok'}`}
                      title="Devices signed in during the last 30 days"
                    >
                      {u.devices}{u.device_limit != null ? ` / ${u.device_limit}` : ''}
                    </span>
                    {u.last_active && <small className="a-muted">active {fmtDate(u.last_active)}</small>}
                  </td>
                  <td className="a-muted">{fmtDate(u.created_at)}</td>
                  <td>
                    {u.manual_subscription_id ? (
                      <div className="a-row">
                        <span className="a-muted">until {fmtDate(u.manual_until)}</span>
                        <form action={endComplimentary.bind(null, u.manual_subscription_id)}>
                          <button className="btn btn-gray btn-small">End</button>
                        </form>
                      </div>
                    ) : (
                      <form action={grantComplimentary.bind(null, u.id)} className="a-row">
                        <select name="plan" className="select a-sm" aria-label="Plan" defaultValue="premium">
                          <option value="standard">Standard</option>
                          <option value="premium">Premium</option>
                        </select>
                        <select name="days" className="select a-sm" aria-label="Duration" defaultValue="30">
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                          <option value="365">1 year</option>
                        </select>
                        <button className="btn btn-gray btn-small">Give</button>
                      </form>
                    )}
                  </td>
                  <td>
                    {u.roles.includes('admin') ? (
                      <span className="a-muted">Admin</span>
                    ) : (
                      <form action={setUploader.bind(null, u.id, !u.roles.includes('editor'))}>
                        <button className={`btn btn-small ${u.roles.includes('editor') ? 'btn-gray' : 'btn-accent'}`}>
                          {u.roles.includes('editor') ? 'Remove uploader' : 'Make uploader'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
