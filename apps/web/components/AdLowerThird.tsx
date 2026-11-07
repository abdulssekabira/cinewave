'use client';

import { useEffect, useRef, useState } from 'react';
import { logAdEvent, pickAd, type Ad, type AdPlan } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

/**
 * Lower-third advert over the film. Counts only time actually watched: the
 * first advert after `firstAfterSec`, then one every `everySec`, each shown
 * for `showSec` (the viewer can close it after a moment). The film never stops.
 */
export function AdLowerThird({ plan, time, playing, titleId, raised }: { plan: AdPlan; time: number; playing: boolean; titleId: string; raised: boolean }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [canClose, setCanClose] = useState(false);
  const watched = useRef(0);
  const lastT = useRef<number | null>(null);
  const nextAt = useRef(plan.firstAfterSec);
  const lastAdId = useRef<string | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) { lastT.current = null; return; }
    if (lastT.current !== null) {
      const d = time - lastT.current;
      if (d > 0 && d < 3) watched.current += d; // ignore jumps (seeking)
    }
    lastT.current = time;
    if (!ad && watched.current >= nextAt.current) {
      const next = pickAd(plan.ads, lastAdId.current);
      nextAt.current = watched.current + plan.everySec;
      if (!next) return;
      lastAdId.current = next.id;
      setAd(next);
      setCanClose(false);
      setTimeout(() => setCanClose(true), 4000);
      logAdEvent(browserClient(), next.id, 'view', titleId).catch(() => {});
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setAd(null), plan.showSec * 1000);
    }
  }, [time, playing, ad, plan, titleId]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  if (!ad) return null;
  const open = () => {
    if (!ad.link_url) return;
    logAdEvent(browserClient(), ad.id, 'click', titleId).catch(() => {});
    window.open(ad.link_url, '_blank', 'noopener');
  };
  return (
    <div className={`ad-l3${raised ? ' raised' : ''}`} role="complementary" aria-label="Advertisement" onClick={(e) => e.stopPropagation()}>
      {ad.image_url && <img src={ad.image_url} alt="" className="ad-l3-img" />}
      <div className="ad-l3-text">
        <span className="ad-l3-tag">Ad</span>
        <b>{ad.headline}</b>
        {ad.subtext && <span>{ad.subtext}</span>}
      </div>
      {ad.link_url && <button type="button" className="ad-l3-cta" onClick={open}>{ad.cta}</button>}
      {canClose && <button type="button" className="ad-l3-x" aria-label="Close advert" onClick={() => setAd(null)}>×</button>}
    </div>
  );
}
