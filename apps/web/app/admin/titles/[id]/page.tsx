import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGenres } from '@cinewave/shared';
import {
  availability,
  fmtDate,
  requireStaff,
  rightsActive,
  todayKampala,
  type AdminTitle,
  type Partner,
  type RightsRow,
} from '@/lib/admin';
import { deleteRights, endRights } from '../actions';
import { RightsForm } from '@/components/admin/RightsForm';
import { TitleForm } from '@/components/admin/TitleForm';
import { VideoUpload } from '@/components/admin/VideoUpload';
import { muxConfigured } from '@/lib/mux';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditTitle({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { sb, isAdmin } = await requireStaff();

  const [{ data: t }, genres, { data: tg }, { data: rightsData }, { data: partnerData }, { data: media }] = await Promise.all([
    sb.from('titles').select('*').eq('id', id).maybeSingle(),
    getGenres(sb),
    sb.from('title_genres').select('genres(slug)').eq('title_id', id),
    sb.from('rights').select('*').eq('title_id', id).order('starts_at', { ascending: false }),
    sb.from('partners').select('*').order('name'),
    sb.from('media_assets').select('status, duration_seconds, error_text')
      .eq('title_id', id).eq('kind', 'feature').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!t) notFound();

  const title = t as AdminTitle;
  const rights = (rightsData ?? []) as RightsRow[];
  const partners = (partnerData ?? []) as Partner[];
  const partnerName = new Map(partners.map((p) => [p.id, p.name]));
  const selected = ((tg ?? []) as unknown as { genres: { slug: string } | null }[])
    .map((r) => r.genres?.slug)
    .filter((s): s is string => Boolean(s));
  const av = availability(title, rights);

  return (
    <>
      <div className="a-head">
        <div>
          <Link href="/admin/titles" className="a-back">← Films</Link>
          <h1>{title.title}</h1>
        </div>
        <div className="a-row">
          <span className={`a-badge ${av.tone}`}>{av.label}</span>
          {av.tone === 'ok' && <Link href={`/title/${title.slug}`} className="btn btn-gray btn-small" target="_blank">View on site ↗</Link>}
        </div>
      </div>

      {saved && <div className="form-msg ok" role="status">Saved.</div>}
      {title.status === 'published' && av.tone === 'warn' && (
        <div className="form-msg error">This film is published but viewers can’t see it yet — add an active rights window below.</div>
      )}

      <TitleForm title={title} genres={genres} selectedGenres={selected} />

      <section className="a-card" style={{ marginTop: 24 }} id="rights">
        <h2>Rights windows</h2>
        <p className="a-muted" style={{ marginTop: -4 }}>
          A film is shown only where and while a rights window is active. Match each window to a signed agreement.
        </p>
        {rights.length === 0 ? (
          <p className="a-muted"><b>No rights yet.</b> This film won’t be visible until you add one.</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr><th>Agreement</th><th>Where</th><th>Dates</th><th>Allows</th><th /></tr>
              </thead>
              <tbody>
                {rights.map((r) => {
                  const active = rightsActive(r);
                  const future = Date.parse(r.starts_at) > Date.now();
                  return (
                    <tr key={r.id}>
                      <td>
                        <b>{r.contract_ref}</b>
                        <small>{r.partner_id ? partnerName.get(r.partner_id) : 'Own content'}</small>
                      </td>
                      <td>{r.territories.includes('*') ? 'Worldwide' : r.territories.join(', ')}</td>
                      <td>
                        {fmtDate(r.starts_at)} → {r.ends_at ? fmtDate(r.ends_at) : 'no end'}
                        <small>
                          <span className={`a-badge ${active ? 'ok' : future ? 'muted' : 'warn'}`}>
                            {active ? 'Active' : future ? 'Starts later' : 'Ended'}
                          </span>
                        </small>
                      </td>
                      <td className="a-muted">
                        {['Streaming', r.allow_ads && 'Ads', r.allow_download && `Downloads${r.download_expiry_hours ? ` (${r.download_expiry_hours}h)` : ''}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </td>
                      <td>
                        {isAdmin && (
                          <div className="a-row">
                            {active && (
                              <form action={endRights.bind(null, r.id, title.id)}>
                                <button className="btn btn-gray btn-small" title="Set the end date to now">End now</button>
                              </form>
                            )}
                            <form action={deleteRights.bind(null, r.id, title.id)}>
                              <button className="btn btn-gray btn-small" title="Delete this record (use End now to keep history)">Delete</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin ? (
          <RightsForm titleId={title.id} partners={partners} today={todayKampala()} />
        ) : (
          <p className="a-muted">Only administrators can add or change rights.</p>
        )}
      </section>

      <section className="a-card" style={{ marginTop: 24 }} id="video">
        <h2>Video file</h2>
        <VideoUpload
          titleId={title.id}
          connected={muxConfigured()}
          initial={media ? { status: media.status, duration: media.duration_seconds, error: media.error_text } : { status: 'none' }}
        />
      </section>
    </>
  );
}
