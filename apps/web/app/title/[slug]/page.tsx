import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  entitlementMessage,
  formatRuntime,
  genreLabel,
  getEntitlement,
  getGenres,
  getProfile,
  getRelated,
  getTitleBySlug,
  getWatchlistIds,
  PLAN_LABEL,
} from '@cinewave/shared';
import { createClient, getUser, viewerCountry } from '@/lib/supabase/server';
import { HeroArt } from '@/components/HeroArt';
import { DownloadIcon, PlayIcon, PlusIcon } from '@/components/Icons';
import { PosterCard } from '@/components/Poster';
import { Row } from '@/components/Row';
import { TitleMeta } from '@/components/TitleMeta';
import { WatchlistButton } from '@/components/WatchlistButton';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTitleBySlug(await createClient(), slug);
  return t ? { title: t.title, description: t.synopsis ?? undefined } : { title: 'Not found' };
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default async function TitlePage({ params }: Props) {
  const { slug } = await params;
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) notFound();

  const profile = user ? await getProfile(sb, user.id) : null;
  const country = await viewerCountry(profile?.country_code);
  const [ent, related, watchlist, genreList, progress] = await Promise.all([
    getEntitlement(sb, title.id, country),
    getRelated(sb, title),
    user ? getWatchlistIds(sb) : Promise.resolve(new Set<string>()),
    getGenres(sb, true),
    user
      ? sb.from('watch_progress').select('position_seconds, duration_seconds, completed').eq('title_id', title.id).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const resumeAt = progress && !progress.completed && progress.position_seconds > 30 ? progress.position_seconds : 0;
  const total = progress?.duration_seconds || (title.runtime_minutes ?? 0) * 60;
  const mmss = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
  };
  const genreName = new Map(genreList.map((g) => [g.slug, g.name]));
  const people = title.credits;
  const langs = (l: string[]) => l.map((x) => x.toUpperCase()).join(', ');

  return (
    <>
      <section className="hero title-hero">
        <HeroArt title={title} priority />
        <div className="hero-shade" />
        <div className="hero-content">
          <TitleMeta title={title} full />
          <h1 className={`hero-title${title.title.length > 22 ? ' long' : ''}`}>{title.title}</h1>
          {(title.genres.length > 0 || title.vj_slug) && (
            <div className="chips">
              {title.vj_slug && (
                <Link href={`/search?vj=${title.vj_slug}`} className="vj-chip">
                  {title.vj_photo_url
                    ? <img className="fs-avatar" src={title.vj_photo_url} alt="" />
                    : <span className="fs-avatar" style={{ background: 'var(--accent)', color: '#fff' }}>{initials(title.vj_name?.replace(/^VJ\s+/i, '') ?? 'VJ')}</span>}
                  {title.vj_name}
                </Link>
              )}
              {title.genres.map((g) => (
                <Link key={g} href={`/search?genre=${g}`} className="chip">{genreName.get(g) ?? genreLabel(g)}</Link>
              ))}
            </div>
          )}
          <div className="hero-actions">
            {ent.can_play ? (
              <Link href={`/watch/${title.slug}`} className="btn btn-play">
                <PlayIcon size={18} /> {resumeAt ? `Resume ${mmss(resumeAt)}` : 'Play'}
              </Link>
            ) : ent.reason === 'sign_in_required' ? (
              <Link href={`/login?next=/title/${title.slug}`} className="btn btn-play"><PlayIcon size={18} /> Sign in to watch</Link>
            ) : ent.reason === 'upgrade_required' ? (
              <Link href="/plans" className="btn btn-accent">Get {PLAN_LABEL[ent.required_plan ?? 'standard']}</Link>
            ) : ent.reason === 'device_limit' ? (
              <Link href="/account#devices" className="btn btn-accent">Manage devices</Link>
            ) : (
              <button className="btn btn-play" disabled>Unavailable</button>
            )}
            {user ? (
              <WatchlistButton titleId={title.id} slug={title.slug} initial={watchlist.has(title.id)} />
            ) : (
              <Link href={`/login?next=/title/${title.slug}`} className="btn btn-gray"><PlusIcon size={20} /> My List</Link>
            )}
          </div>
          {ent.can_play && resumeAt > 0 && total > 0 && (
            <div className="resume-meter" aria-label={`Watched ${Math.round((resumeAt / total) * 100)}%`}>
              <div style={{ width: `${Math.min(100, (resumeAt / total) * 100)}%` }} />
            </div>
          )}
          {!ent.can_play && <p className="hero-notice">{entitlementMessage(ent.reason, ent.required_plan)}</p>}
          {title.downloadable && ent.can_play && (
            <p className="hero-notice" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DownloadIcon size={16} />
              {ent.can_download ? 'Download for offline viewing in the Android app.' : 'Offline downloads with Premium in the Android app.'}
            </p>
          )}
        </div>
      </section>

      <div className="title-body">
        <div>
          <h2 className="section-h">Synopsis</h2>
          <p className="synopsis">{title.synopsis ?? 'No synopsis yet.'}</p>
          {people.length > 0 && (
            <>
              <h2 className="section-h" style={{ marginTop: 36 }}>Cast &amp; Crew</h2>
              <div className="cast">
                {people.map((p) => (
                  <div key={`${p.name}-${p.role}`} className="cast-person">
                    <div className="cast-avatar" aria-hidden="true">{initials(p.name)}</div>
                    <div className="cast-name">{p.name}</div>
                    <div className="cast-role">{p.role}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <h2 className="section-h">Details</h2>
          <dl className="facts">
            {title.runtime_minutes && (<><dt>Runtime</dt><dd>{formatRuntime(title.runtime_minutes)}</dd></>)}
            {title.maturity_rating && (<><dt>Rated</dt><dd>{title.maturity_rating}</dd></>)}
            {title.audio_languages.length > 0 && (<><dt>Audio</dt><dd>{langs(title.audio_languages)}</dd></>)}
            {title.subtitle_languages.length > 0 && (<><dt>Subtitles</dt><dd>{langs(title.subtitle_languages)}</dd></>)}
            <dt>Plan</dt><dd>{PLAN_LABEL[title.required_plan]}</dd>
            {title.rating != null && title.rating_source && (<><dt>Rating source</dt><dd>{title.rating_source}</dd></>)}
            {title.content_warnings.length > 0 && (<><dt>Warnings</dt><dd>{title.content_warnings.join(', ')}</dd></>)}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <div className="rows" style={{ paddingTop: 0 }}>
          <Row eyebrow="Similar" label="More Like This">
            {related.map((t) => <PosterCard key={t.id} title={t} />)}
          </Row>
        </div>
      )}
    </>
  );
}
