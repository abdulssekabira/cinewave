import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/admin';
import { AdForm, AdTimingForm } from '@/components/admin/AdForms';
import { deleteAd, setAdActive } from './actions';

export const metadata: Metadata = { title: 'Adverts' };

export default async function AdsPage() {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) notFound();
  const [{ data: ads }, { data: stats }, { data: settings }] = await Promise.all([
    sb.from('ads').select('*').order('created_at', { ascending: false }),
    sb.rpc('ad_stats'),
    sb.from('site_settings').select('key, value').in('key', ['ad_first_after_min', 'ad_every_min', 'ad_show_sec']),
  ]);
  const st = new Map(((stats ?? []) as { ad_id: string; views: number; clicks: number }[]).map((r) => [r.ad_id, r]));
  const set = (k: string, d: string) => settings?.find((r) => r.key === k)?.value ?? d;
  const now = Date.now();

  return (
    <>
      <h1 className="a-title">Adverts</h1>
      <p className="a-muted" style={{ marginTop: -6 }}>
        Adverts appear as a slim bar at the bottom of the video for viewers on a plan with ads (Free), on films whose rights allow ads.
        The film keeps playing; viewers can close the bar after a few seconds.
      </p>

      <section className="a-card">
        <h2>Running and past adverts</h2>
        {!ads?.length ? (
          <p className="a-muted">No adverts yet. Add your first one below.</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Advert</th><th>Dates</th><th>Shown</th><th>Tapped</th><th /></tr></thead>
              <tbody>
                {ads.map((a) => {
                  const s = st.get(a.id);
                  const running = a.active && Date.parse(a.starts_at) <= now && (!a.ends_at || Date.parse(a.ends_at) > now);
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{a.name}</b>
                        <small>{a.headline}</small>
                        <small><span className={`a-badge ${running ? 'ok' : 'muted'}`}>{running ? 'Running' : a.active ? 'Scheduled / ended' : 'Off'}</span></small>
                      </td>
                      <td className="a-muted">
                        {new Date(a.starts_at).toLocaleDateString('en-GB')} → {a.ends_at ? new Date(a.ends_at).toLocaleDateString('en-GB') : 'no end'}
                      </td>
                      <td>{Number(s?.views ?? 0).toLocaleString()}</td>
                      <td>{Number(s?.clicks ?? 0).toLocaleString()}{s && Number(s.views) > 0 ? <small>{((Number(s.clicks) / Number(s.views)) * 100).toFixed(1)}%</small> : null}</td>
                      <td>
                        <div className="a-row">
                          <form action={setAdActive.bind(null, a.id, !a.active)}>
                            <button className="btn btn-gray btn-small">{a.active ? 'Turn off' : 'Turn on'}</button>
                          </form>
                          <form action={deleteAd.bind(null, a.id)}>
                            <button className="btn btn-gray btn-small">Delete</button>
                          </form>
                        </div>
                        <details style={{ marginTop: 8 }}>
                          <summary className="a-muted">Edit</summary>
                          <div style={{ marginTop: 10 }}><AdForm ad={a} /></div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="a-card" style={{ marginTop: 20 }}>
        <h2>Add an advert</h2>
        <AdForm />
      </section>

      <section className="a-card" style={{ marginTop: 20 }}>
        <h2>Timing</h2>
        <AdTimingForm first={set('ad_first_after_min', '2')} every={set('ad_every_min', '10')} show={set('ad_show_sec', '12')} />
      </section>
    </>
  );
}
