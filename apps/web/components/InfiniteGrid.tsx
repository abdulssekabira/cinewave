'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SEARCH_PAGE, searchTitles, type CatalogTitle, type SearchParams } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';
import { PosterCard } from './Poster';

type Saved = { items: CatalogTitle[]; done: boolean; y: number; at: number };

/**
 * Endless list of titles: loads more as the viewer scrolls down. Remembers what
 * was loaded and where the viewer was, so coming back from a film returns to
 * the same spot instead of the top.
 */
export function InfiniteGrid({ initial, params, stateKey }: { initial: CatalogTitle[]; params: SearchParams; stateKey: string }) {
  const key = `gle:grid:${stateKey}`;
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length < SEARCH_PAGE);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const restoreY = useRef<number | null>(null);
  const state = useRef({ items, done });
  state.current = { items, done };

  // Coming back: put back the titles that were loaded and the scroll position.
  useLayoutEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Saved | null;
      if (s && Date.now() - s.at < 30 * 60_000 && s.items.length >= initial.length) {
        setItems(s.items);
        setDone(s.done);
        restoreY.current = s.y;
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useLayoutEffect(() => {
    if (restoreY.current == null) return;
    const y = restoreY.current;
    restoreY.current = null;
    window.scrollTo(0, y);
    requestAnimationFrame(() => window.scrollTo(0, y)); // after images settle
  }, [items]);

  // Remember where the viewer is.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ ...state.current, y: window.scrollY, at: Date.now() } satisfies Saved));
      } catch { /* storage full or private mode */ }
    };
    const onScroll = () => { clearTimeout(t); t = setTimeout(save, 150); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('click', save, true); // just before opening a film
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('click', save, true);
    };
  }, [key]);

  const more = useCallback(async () => {
    if (busy || state.current.done) return;
    setBusy(true); setFailed(false);
    try {
      const next = await searchTitles(browserClient(), { ...params, offset: state.current.items.length, limit: SEARCH_PAGE });
      setItems((xs) => {
        const seen = new Set(xs.map((x) => x.id));
        return [...xs, ...next.filter((x) => !seen.has(x.id))];
      });
      if (next.length < SEARCH_PAGE) setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, params]);

  // Load the next batch a little before the viewer reaches the bottom.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver((es) => { if (es[0]?.isIntersecting) more(); }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, done]);

  return (
    <>
      <div className="grid">
        {items.map((t) => <PosterCard key={t.id} title={t} />)}
      </div>
      <div ref={sentinel} className="grid-more" aria-live="polite">
        {busy && <span className="spinner" aria-label="Loading more" />}
        {failed && <button type="button" className="btn btn-gray btn-small" onClick={more}>Couldn’t load more · Try again</button>}
        {done && items.length > SEARCH_PAGE && <span className="a-muted">You’ve reached the end · {items.length} titles</span>}
      </div>
    </>
  );
}
