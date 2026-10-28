import Link from 'next/link';
import { PLAN_LABEL, posterPalette } from '@cinewave/shared';
import { availability, fmtDate, requireStaff, type AdminTitle, type RightsRow } from '@/lib/admin';

type Props = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminTitles({ searchParams }: Props) {
  const { sb } = await requireStaff();
  const sp = await searchParams;
  let q = sb
    .from('titles')
    .select('id, slug, title, status, required_plan, poster_url, release_year, is_featured, updated_at')
    .order('updated_at', { ascending: false });
  if (sp.q?.trim()) q = q.ilike('title', `%${sp.q.trim().replace(/[%_]/g, '')}%`);
  if (sp.status === 'draft' || sp.status === 'published' || sp.status === 'archived') q = q.eq('status', sp.status);
  const [{ data }, { data: rightsData }] = await Promise.all([q, sb.from('rights').select('*')]);

  const titles = (data ?? []) as AdminTitle[];
  const rights = (rightsData ?? []) as RightsRow[];

  return (
    <>
      <div className="a-head">
        <h1>Films</h1>
        <Link href="/admin/titles/new" className="btn btn-accent btn-small">+ Add film</Link>
      </div>

      <form className="a-filters" action="/admin/titles">
        <input name="q" className="input" placeholder="Search films…" defaultValue={sp.q ?? ''} aria-label="Search films" />
        <select name="status" className="select" defaultValue={sp.status ?? ''} aria-label="Status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="btn btn-gray btn-small" type="submit">Filter</button>
      </form>

      {titles.length === 0 ? (
        <div className="empty">
          <h2>No films yet</h2>
          <p>Add your first film to start building the catalogue.</p>
          <Link href="/admin/titles/new" className="btn btn-accent" style={{ marginTop: 16 }}>+ Add film</Link>
        </div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr><th>Film</th><th>Visible to viewers</th><th>Plan</th><th>Updated</th></tr>
            </thead>
            <tbody>
              {titles.map((t) => {
                const av = availability(t, rights.filter((r) => r.title_id === t.id));
                const p = posterPalette(t.slug);
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/admin/titles/${t.id}`} className="a-film">
                        <span className="a-thumb" style={t.poster_url ? undefined : { background: `linear-gradient(150deg, ${p.to}, ${p.from})` }}>
                          {t.poster_url && <img src={t.poster_url} alt="" />}
                        </span>
                        <span>
                          <b>{t.title}</b>
                          <small>{[t.release_year, t.is_featured && '★ Featured'].filter(Boolean).join(' · ') || '—'}</small>
                        </span>
                      </Link>
                    </td>
                    <td><span className={`a-badge ${av.tone}`}>{av.label}</span></td>
                    <td>{PLAN_LABEL[t.required_plan]}</td>
                    <td className="a-muted">{fmtDate(t.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
