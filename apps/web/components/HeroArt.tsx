import type { CatalogTitle } from '@cinewave/shared';
import { GeneratedArt } from './Poster';

/**
 * Background art for the hero and title pages.
 * - Wide backdrop: full-bleed.
 * - Portrait poster only: blurred fill + sharp key art on the right
 *   (full-bleed on phones, where portrait art fits naturally).
 * - Nothing yet: generated colours.
 */
export function HeroArt({ title, priority }: { title: CatalogTitle; priority?: boolean }) {
  const loading = priority ? 'eager' : 'lazy';
  if (title.backdrop_url) {
    return <img className="art-full" src={title.backdrop_url} alt="" loading={loading} />;
  }
  if (title.poster_url) {
    return (
      <>
        <img className="art-blur" src={title.poster_url} alt="" loading={loading} />
        <img className="art-key" src={title.poster_url} alt="" loading={loading} />
      </>
    );
  }
  return <GeneratedArt title={title} className="art-generated" />;
}
