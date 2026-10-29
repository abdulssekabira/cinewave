import Link from 'next/link';
import { availability, fmtDate, fmtDateTime, requireStaff, rightsActive, type AdminTitle, type RightsRow } from '@/lib/admin';

type Audit = { id: number; action: string; entity: string; details: Record<string, unknown> | null; at: string };

export default async function AdminOverview() {
  const { sb, isAdmin } = await requireStaff();
  const [titlesRes, rightsRes, usersRes, subsRes, auditRes, readyRes, hiddenPartsRes] = await Promise.all([
    sb.from('titles').select('id, slug, title, status, updated_at').order('updated_at', { ascending: false }),
    sb.from('rights').select('*'),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['trialing', 'active', 'past_due']),
    sb.from('audit_log').select('id, action, entity, details, at').order('at', { ascending: false }).limit(8),
    sb.from('media_assets').select('title_id, episode_id').eq('status', 'ready'),
    sb.from('episodes').select('id, title_id, season, number, name').eq('published', false),
  ]);

  const titles = (titlesRes.data ?? []) as Pick<AdminTitle, 'id' | 'slug' | 'title' | 'status' | 'updated_at'>[];
  const rights = (rightsRes.data ?? []) as RightsRow[];
  const byTitle = new Map<string, RightsRow[]>();
  for (const r of rights) byTitle.set(r.title_id, [...(byTitle.get(r.title_id) ?? []), r]);

  const live = titles.filter((t) => availability(t, byTitle.get(t.id) ?? []).tone === 'ok');
  const hidden = titles.filter((t) => t.status === 'published' && availability(t, byTitle.get(t.id) ?? []).tone === 'warn');
  const drafts = titles.filter((t) => t.status === 'draft');
  const in30 = Date.now() + 30 * 864e5;
  const expiring = rights
    .filter((r) => rightsActive(r) && r.ends_at && Date.parse(r.ends_at) < in30)
    .sort((a, b) => Date.parse(a.ends_at!) - Date.parse(b.ends_at!));
  const titleName = new Map(titles.map((t) => [t.id, t]));
  const audit = (auditRes.data ?? []) as Audit[];

  // Waiting for approval: drafts whose video is ready, and hidden parts with a ready video.
  const ready = (readyRes.data ?? []) as { title_id: string; episode_id: string | null }[];
  const readyFilms = new Set(ready.filter((r) => !r.episode_id).map((r) => r.title_id));
  const readyParts = new Set(ready.filter((r) => r.episode_id).map((r) => r.episode_id!));
  const waitingFilms = drafts.filter((t) => readyFilms.has(t.id));
  const waitingParts = ((hiddenPartsRes.data ?? []) as { id: string; title_id: string; season: number; number: number; name: string | null }[])
    .filter((e) => readyParts.has(e.id) && titleName.get(e.title_id)?.status !== 'draft');

  return (
    <>
      <div className="a-head">
        <h1>Overview</h1>
        <Link href="/admin/titles/new" className="btn btn-accent btn-small">+ Add film</Link>
      </div>

      <div className="a-stats">
        <div className="a-stat"><b>{live.length}</b><span>Films live</span></div>
        <div className="a-stat"><b>{drafts.length}</b><span>Drafts</span></div>
        <div className="a-stat"><b>{usersRes.count ?? 0}</b><span>Users</span></div>
        <div className="a-stat"><b>{subsRes.count ?? 0}</b><span>Active subscriptions</span></div>
      </div>

      {isAdmin && (waitingFilms.length > 0 || waitingParts.length > 0) && (
        <section className="a-card" style={{ marginBottom: 20 }}>
          <h2>Waiting for your approval</h2>
          <p className="a-muted" style={{ marginTop: -4 }}>Video is ready. Check it, then publish the film or show the part.</p>
          <ul className="a-list">
            {waitingFilms.map((t) => (
              <li key={t.id}>
                <span className="a-badge muted">Draft</span>
                <Link href={`/admin/titles/${t.id}`}>{t.title}</Link>
                <span className="a-muted">set Status to Published</span>
              </li>
            ))}
            {waitingParts.map((e) => (
              <li key={e.id}>
                <span className="a-badge muted">New part</span>
                <Link href={`/admin/titles/${e.title_id}#parts`}>{titleName.get(e.title_id)?.title ?? 'Series'} · Part {e.number}{e.name ? ` · ${e.name}` : ''}</Link>
                <span className="a-muted">tap Show to viewers</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="a-grid2">
        <section className="a-card">
          <h2>Needs attention</h2>
          {hidden.length === 0 && expiring.length === 0 ? (
            <p className="a-muted">Nothing right now.</p>
          ) : (
            <ul className="a-list">
              {hidden.map((t) => (
                <li key={t.id}>
                  <span className="a-badge warn">Hidden</span>
                  <Link href={`/admin/titles/${t.id}`}>{t.title}</Link>
                  <span className="a-muted">published but no active rights</span>
                </li>
              ))}
              {expiring.map((r) => (
                <li key={r.id}>
                  <span className="a-badge warn">Expiring</span>
                  <Link href={`/admin/titles/${r.title_id}`}>{titleName.get(r.title_id)?.title ?? 'Unknown film'}</Link>
                  <span className="a-muted">licence {r.contract_ref} ends {fmtDate(r.ends_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="a-card">
          <h2>Recent changes</h2>
          {audit.length === 0 ? (
            <p className="a-muted">No changes yet.</p>
          ) : (
            <ul className="a-list">
              {audit.map((a) => {
                const d = a.details ?? {};
                const plan = typeof d.plan_id === 'string' ? `${d.plan_id.charAt(0).toUpperCase()}${d.plan_id.slice(1)}` : '';
                const name =
                  (d.title as string) ??
                  (d.contract_ref as string) ??
                  (plan ? `${plan}${d.provider === 'manual' ? ' (complimentary)' : ''}` : a.entity);
                const verb = a.action === 'insert' ? 'Added' : a.action === 'delete' ? 'Removed' : 'Updated';
                const what = a.entity === 'rights' ? 'rights' : a.entity === 'titles' ? 'film' : 'subscription';
                return (
                  <li key={a.id}>
                    <span className="a-muted a-time">{fmtDateTime(a.at)}</span>
                    <span>{verb} {what} <b>{name}</b></span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
