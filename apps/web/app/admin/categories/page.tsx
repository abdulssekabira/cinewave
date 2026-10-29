import { requireStaff } from '@/lib/admin';
import { AddCategory, CategoryItem } from '@/components/admin/CategoryItem';

export default async function Categories() {
  const { sb } = await requireStaff();
  const [{ data: vjs }, { data: genres }, { data: titles }, { data: tg }] = await Promise.all([
    sb.from('vjs').select('*').order('sort_order').order('name'),
    sb.from('genres').select('*').order('sort_order').order('name'),
    sb.from('titles').select('vj_id'),
    sb.from('title_genres').select('genre_id'),
  ]);
  const vjCount = new Map<number, number>();
  for (const t of titles ?? []) if (t.vj_id) vjCount.set(t.vj_id, (vjCount.get(t.vj_id) ?? 0) + 1);
  const gCount = new Map<number, number>();
  for (const r of tg ?? []) gCount.set(r.genre_id, (gCount.get(r.genre_id) ?? 0) + 1);
  const V = vjs ?? [];
  const G = genres ?? [];

  return (
    <>
      <div className="a-head">
        <div>
          <h1>VJs &amp; genres</h1>
          <p className="a-muted" style={{ margin: '4px 0 0' }}>
            Viewers filter films by these on the Movies page. Choose a film’s VJ and genres in Films → the film.
          </p>
        </div>
      </div>

      <div className="cat-grid">
        <section className="a-card">
          <h2>VJs</h2>
          {V.length === 0 ? (
            <p className="a-muted">No VJs yet. Add your first one below; the VJ filter appears on the Movies page as soon as one exists.</p>
          ) : (
            <ul className="cat-list">
              {V.map((v, i) => (
                <CategoryItem key={v.id} table="vjs" item={v} films={vjCount.get(v.id) ?? 0} first={i === 0} last={i === V.length - 1} />
              ))}
            </ul>
          )}
          <AddCategory table="vjs" />
        </section>

        <section className="a-card">
          <h2>Genres</h2>
          <ul className="cat-list">
            {G.map((g, i) => (
              <CategoryItem key={g.id} table="genres" item={g} films={gCount.get(g.id) ?? 0} first={i === 0} last={i === G.length - 1} />
            ))}
          </ul>
          <AddCategory table="genres" />
        </section>
      </div>
    </>
  );
}
