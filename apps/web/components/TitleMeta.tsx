import { formatRuntime, ratingLabel, type CatalogTitle } from '@cinewave/shared';
import { StarIcon } from './Icons';

/** "MOVIE  2026  ★ 8.2  ·  2h 7m  ·  13+" */
export function TitleMeta({ title, full }: { title: CatalogTitle; full?: boolean }) {
  const rating = ratingLabel(title.rating);
  return (
    <div className="meta-row">
      <span className="pill">{title.kind === 'series' ? 'Series' : 'Movie'}</span>
      {title.kind === 'series' && Boolean(title.episode_count) && <span>{title.episode_count} parts</span>}
      {title.required_plan === 'free' && <span className="pill pill-plain">Free</span>}
      {title.release_year && <span>{title.release_year}</span>}
      {rating && (
        <span className="rating" title={title.rating_source ? `Rating: ${title.rating_source}` : undefined}>
          <StarIcon size={14} /> {rating}
        </span>
      )}
      {full && title.runtime_minutes && (
        <>
          <span className="dot-sep" />
          <span>{formatRuntime(title.runtime_minutes)}</span>
        </>
      )}
      {full && title.maturity_rating && (
        <>
          <span className="dot-sep" />
          <span>{title.maturity_rating}</span>
        </>
      )}
    </div>
  );
}
