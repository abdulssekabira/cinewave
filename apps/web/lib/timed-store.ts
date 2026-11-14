'use client';

import { useSyncExternalStore } from 'react';
import { getTimedComments, type TimedComment } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

/**
 * Shared state between the player (pop-ups, comment button) and the comment
 * list under it: where the viewer is, how far they've honestly watched, and
 * the comments loaded so far for this film/episode.
 */
export type TimedState = {
  titleId: string | null;
  episodeId: string | null;
  time: number;      // current position
  maxTime: number;   // furthest position seen on this page (list shows up to here)
  reached: number;   // honest mark from the server
  playing: boolean;
  comments: TimedComment[];
  loadedTo: number;
};

const initial: TimedState = { titleId: null, episodeId: null, time: 0, maxTime: 0, reached: 0, playing: false, comments: [], loadedTo: -1 };
let state: TimedState = initial;
const subs = new Set<() => void>();
let loading = false;
export const controls: { pause?: () => void; play?: () => void; isPlaying?: () => boolean } = {};

export function setTimed(p: Partial<TimedState>) {
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export function getTimed() { return state; }
export function useTimed<T>(pick: (s: TimedState) => T): T {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => pick(state),
    () => pick(initial),
  );
}

/** Start fresh for a film/episode. */
export function resetTimed(titleId: string, episodeId: string | null) {
  if (state.titleId === titleId && state.episodeId === episodeId) return;
  setTimed({ ...initial, titleId, episodeId });
}

const merge = (a: TimedComment[], b: TimedComment[]) => {
  const m = new Map(a.map((c) => [c.id, c]));
  for (const c of b) m.set(c.id, c);
  return [...m.values()].sort((x, y) => x.at_seconds - y.at_seconds || x.created_at.localeCompare(y.created_at));
};

/** Loads comments ahead of the viewer in 10-minute windows. */
export async function ensureLoaded(upTo: number) {
  const s = state;
  if (!s.titleId || loading || upTo <= s.loadedTo) return;
  loading = true;
  const from = s.loadedTo + 1, to = Math.max(upTo, from) + 600;
  try {
    const list = await getTimedComments(browserClient(), s.titleId, s.episodeId, from, to);
    if (state.titleId === s.titleId && state.episodeId === s.episodeId) setTimed({ comments: merge(state.comments, list), loadedTo: to });
  } catch { /* try again on the next tick */ }
  loading = false;
}

/** Re-reads everything loaded so far (new comments from others, reply counts). */
export async function refreshTimed() {
  const s = state;
  if (!s.titleId || s.loadedTo < 0) return;
  try {
    const list = await getTimedComments(browserClient(), s.titleId, s.episodeId, 0, s.loadedTo);
    if (state.titleId === s.titleId && state.episodeId === s.episodeId) setTimed({ comments: list });
  } catch { /* ignore */ }
}
