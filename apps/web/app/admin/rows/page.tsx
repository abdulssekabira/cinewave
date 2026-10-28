import Link from 'next/link';
import { requireStaff, type AdminTitle } from '@/lib/admin';
import { addToRow, createRow, deleteRow, moveInRow, moveRow, removeFromRow, setRowActive } from './actions';

type Row = {
  id: number;
  name: string;
  active: boolean;
  sort_order: number;
  collection_items: { title_id: string; position: number }[];
};

export default async function Rows() {
  const { sb } = await requireStaff();
  const [{ data: rowData }, { data: titleData }] = await Promise.all([
    sb.from('collections').select('id, name, active, sort_order, collection_items(title_id, position)').order('sort_order'),
    sb.from('titles').select('id, title, status').neq('status', 'archived').order('title'),
  ]);
  const rows = (rowData ?? []) as Row[];
  const titles = (titleData ?? []) as Pick<AdminTitle, 'id' | 'title' | 'status'>[];
  const name = new Map(titles.map((t) => [t.id, t]));

  return (
    <>
      <div className="a-head"><h1>Home rows</h1></div>
      <p className="a-muted" style={{ marginTop: -8, marginBottom: 20 }}>
        Trending, Recently Added and Free to Watch fill themselves. Add your own curated rows here — they appear below those on web and Android.
        To put a film in the big hero at the top, tick “Feature on the home page hero” on the film.
      </p>

      <form action={createRow} className="a-card a-inline">
        <label htmlFor="row-name" className="sr-only">New row name</label>
        <input id="row-name" name="name" className="input" placeholder="New row, e.g. “Made in Uganda”" required />
        <button className="btn btn-accent btn-small">Create row</button>
      </form>

      {rows.length === 0 && <div className="empty"><h2>No curated rows yet</h2></div>}

      {rows.map((r, ri) => {
        const items = [...r.collection_items].sort((a, b) => a.position - b.position);
        const inRow = new Set(items.map((i) => i.title_id));
        return (
          <section key={r.id} className="a-card">
            <div className="a-head small">
              <h2>
                {r.name} {!r.active && <span className="a-badge muted">Hidden</span>}
              </h2>
              <div className="a-row">
                <form action={moveRow.bind(null, r.id, -1)}><button className="btn btn-gray btn-small" disabled={ri === 0} aria-label="Move row up">↑</button></form>
                <form action={moveRow.bind(null, r.id, 1)}><button className="btn btn-gray btn-small" disabled={ri === rows.length - 1} aria-label="Move row down">↓</button></form>
                <form action={setRowActive.bind(null, r.id, !r.active)}>
                  <button className="btn btn-gray btn-small">{r.active ? 'Hide' : 'Show'}</button>
                </form>
                <form action={deleteRow.bind(null, r.id)}><button className="btn btn-gray btn-small">Delete row</button></form>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="a-muted">Empty — add films below.</p>
            ) : (
              <ol className="a-rowlist">
                {items.map((it, i) => {
                  const t = name.get(it.title_id);
                  return (
                    <li key={it.title_id}>
                      <span className="a-num">{i + 1}</span>
                      <Link href={`/admin/titles/${it.title_id}`}>{t?.title ?? 'Removed film'}</Link>
                      {t && t.status !== 'published' && <span className="a-badge muted">{t.status}</span>}
                      <span className="a-row" style={{ marginLeft: 'auto' }}>
                        <form action={moveInRow.bind(null, r.id, it.title_id, -1)}><button className="btn btn-gray btn-small" disabled={i === 0} aria-label="Move left">↑</button></form>
                        <form action={moveInRow.bind(null, r.id, it.title_id, 1)}><button className="btn btn-gray btn-small" disabled={i === items.length - 1} aria-label="Move right">↓</button></form>
                        <form action={removeFromRow.bind(null, r.id, it.title_id)}><button className="btn btn-gray btn-small">Remove</button></form>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <form action={addToRow.bind(null, r.id)} className="a-inline" style={{ marginTop: 12 }}>
              <label htmlFor={`add-${r.id}`} className="sr-only">Film to add</label>
              <select id={`add-${r.id}`} name="title_id" className="select" defaultValue="" required>
                <option value="" disabled>Choose a film…</option>
                {titles.filter((t) => !inRow.has(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}{t.status === 'draft' ? ' (draft)' : ''}</option>
                ))}
              </select>
              <button className="btn btn-gray btn-small">Add to row</button>
            </form>
          </section>
        );
      })}
    </>
  );
}
