import Link from 'next/link';
import { posterPalette, type CatalogTitle } from '@cinewave/shared';
import { PlayIcon } from './Icons';

/** Generated artwork for titles that don't have a poster yet. */
export function GeneratedArt({ title, className = 'poster-generated' }: { title: CatalogTitle; className?: string }) {
  const p = posterPalette(title.slug);
  return (
    <div
      className={className}
      style={{ background: `linear-gradient(${p.angle}deg, ${p.from} 0%, ${p.to} 100%)` }}
      aria-hidden="true"
    >
      <div className="pg-rule" style={{ background: p.accent }} />
      <div className="pg-title">{title.title}</div>
      {title.release_year && <div className="pg-year">{title.release_year}</div>}
    </div>
  );
}

export function PosterArt({ title }: { title: CatalogTitle }) {
  return title.poster_url ? <img src={title.poster_url} alt="" loading="lazy" /> : <GeneratedArt title={title} />;
}

function PlanBadge({ title }: { title: CatalogTitle }) {
  if (title.required_plan === 'free') return null;
  return <span className={`card-badge ${title.required_plan}`}>{title.required_plan}</span>;
}

export function PosterCard({ title }: { title: CatalogTitle }) {
  return (
    <Link href={`/title/${title.slug}`} className="card">
      <div className="poster">
        <PlanBadge title={title} />
        <PosterArt title={title} />
      </div>
      <div className="card-title">{title.title}</div>
    </Link>
  );
}

/** 16:9 card used for Continue Watching. */
export function LandscapeCard({ title, progress }: { title: CatalogTitle; progress: number }) {
  const img = title.backdrop_url ?? title.poster_url;
  return (
    <Link href={`/watch/${title.slug}`} className="card" aria-label={`Resume ${title.title}, ${progress}% watched`}>
      <div className="landscape">
        {img ? <img src={img} alt="" loading="lazy" /> : <GeneratedArt title={title} />}
        <div className="play-badge"><span className="play-circle"><PlayIcon size={18} /></span></div>
        <div className="progress"><div style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="card-title">{title.title}</div>
    </Link>
  );
}
