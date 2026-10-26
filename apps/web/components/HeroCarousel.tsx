'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { entitlementMessage, type CatalogTitle } from '@cinewave/shared';
import { HeroArt } from './HeroArt';
import { InfoIcon, PlayIcon } from './Icons';
import { TitleMeta } from './TitleMeta';

const INTERVAL = 8000;

export function HeroCarousel({ titles }: { titles: CatalogTitle[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || titles.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setTimeout(() => setI((n) => (n + 1) % titles.length), INTERVAL);
    return () => clearTimeout(t);
  }, [i, paused, titles.length]);

  const t = titles[i];
  if (!t) return null;
  const free = t.required_plan === 'free';

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured films"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {titles.map((s, n) => (
        <div key={s.id} className={`hero-slide${n === i ? ' active' : ''}`} aria-hidden={n !== i}>
          <HeroArt title={s} priority={n === 0} />
        </div>
      ))}
      <div className="hero-shade" />

      <div className="hero-content" aria-live="polite">
        <TitleMeta title={t} />
        <h1 className={`hero-title${t.title.length > 22 ? ' long' : ''}`}>{t.title}</h1>
        {t.synopsis && <p className="hero-synopsis">{t.synopsis}</p>}
        <div className="hero-actions">
          <Link href={free ? `/watch/${t.slug}` : `/title/${t.slug}`} className="btn btn-play">
            <PlayIcon size={18} /> Play
          </Link>
          <Link href={`/title/${t.slug}`} className="btn btn-gray">
            <InfoIcon size={20} /> More Info
          </Link>
        </div>
        {!free && <p className="hero-notice">{entitlementMessage('upgrade_required', t.required_plan)}</p>}
      </div>

      {titles.length > 1 && (
        <div className="hero-dots" role="group" aria-label="Choose featured film">
          {titles.map((s, n) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${s.title}`}
              aria-current={n === i ? 'true' : undefined}
              onClick={() => setI(n)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
