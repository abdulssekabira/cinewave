import Link from 'next/link';
import { genreLabel, posterPalette, type CatalogTitle } from '@cinewave/shared';

export function PosterArt({ title }: { title: CatalogTitle }) {
  if (title.poster_url) {
    return <img src={title.poster_url} alt="" loading="lazy" />;
  }
  const p = posterPalette(title.slug);
  return (
    <div
      className="poster-generated"
      style={{ background: `linear-gradient(${p.angle}deg, ${p.from} 0%, ${p.to} 100%)` }}
      aria-hidden="true"
    >
      <div className="pg-rule" style={{ background: p.accent }} />
      <div className="pg-title">{title.title}</div>
      {title.release_year && <div className="pg-year">{title.release_year}</div>}
    </div>
  );
}

export function AccessBadges({ title }: { title: CatalogTitle }) {
  return (
    <div className="badges">
      <span className={`badge badge-${title.required_plan}`}>
        {title.required_plan === 'free' ? 'Free' : title.required_plan}
      </span>
      {title.downloadable && (
        <span className="badge badge-dl" title="Download available">
          ↓<span className="sr-only">Download available</span>
        </span>
      )}
    </div>
  );
}

export function PosterCard({ title, progress }: { title: CatalogTitle; progress?: number }) {
  return (
    <Link href={`/title/${title.slug}`} className="card" aria-label={title.title}>
      <div className="poster">
        <AccessBadges title={title} />
        <PosterArt title={title} />
      </div>
      {progress !== undefined && (
        <div className="progress" aria-label={`${progress}% watched`}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="card-title">{title.title}</div>
      <div className="card-sub">
        {[title.release_year, title.genres[0] && genreLabel(title.genres[0])].filter(Boolean).join(' · ')}
      </div>
    </Link>
  );
}
