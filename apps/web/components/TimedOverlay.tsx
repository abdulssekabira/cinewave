'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { clockLabel, postTimedComment, type TimedComment } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';
import { controls, ensureLoaded, getTimed, refreshTimed, setTimed, useTimed } from '@/lib/timed-store';

const SHOW_MS = 6500;
const PREF = 'gle:bubbles';

/**
 * Over the film: comments pop up at the moment they were written, and a 💬
 * button to comment on the current scene (only up to the honestly watched mark).
 */
export function TimedOverlay({ signedIn, raised, loginHref }: { signedIn: boolean; raised: boolean; loginHref: string }) {
  const time = useTimed((s) => s.time);
  const playing = useTimed((s) => s.playing);
  const reached = useTimed((s) => s.reached);
  const comments = useTimed((s) => s.comments);
  const [bubbles, setBubbles] = useState<(TimedComment & { key: number })[]>([]);
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [at, setAt] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const last = useRef<number | null>(null);
  const resume = useRef(false);
  const seq = useRef(0);

  useEffect(() => { try { setOn(localStorage.getItem(PREF) !== 'off'); } catch { /* ignore */ } }, []);
  useEffect(() => { ensureLoaded(time + 120); }, [time]);
  useEffect(() => {
    const t = setInterval(() => { if (getTimed().playing) refreshTimed(); }, 60000);
    return () => clearInterval(t);
  }, []);

  // Pop up comments whose moment we just played through (not when jumping around).
  useEffect(() => {
    const prev = last.current;
    last.current = time;
    if (!on || !playing || prev === null) return;
    const d = time - prev;
    if (d <= 0 || d > 3) return;
    const due = comments.filter((c) => c.at_seconds > prev && c.at_seconds <= time);
    if (!due.length) return;
    const add = due.slice(0, 3).map((c) => ({ ...c, key: ++seq.current }));
    setBubbles((b) => [...b, ...add].slice(-3));
    for (const a of add) setTimeout(() => setBubbles((b) => b.filter((x) => x.key !== a.key)), SHOW_MS);
  }, [time, playing, on, comments]);

  function toggleBubbles() {
    const next = !on;
    setOn(next);
    if (!next) setBubbles([]);
    try { localStorage.setItem(PREF, next ? 'on' : 'off'); } catch { /* ignore */ }
    setFlash(next ? 'Comment pop-ups on' : 'Comment pop-ups off');
    setTimeout(() => setFlash(null), 1600);
  }

  function openBox() {
    const t = Math.floor(getTimed().time);
    setAt(t);
    setErr(null);
    resume.current = Boolean(controls.isPlaying?.());
    controls.pause?.();
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setText('');
    if (resume.current) controls.play?.();
  }
  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await postTimedComment(browserClient(), getTimed().titleId!, getTimed().episodeId, at, text);
    setBusy(false);
    if (r) { setErr(r); return; }
    setTimed({ loadedTo: Math.max(getTimed().loadedTo, at) });
    await refreshTimed();
    close();
    setFlash('Comment posted');
    setTimeout(() => setFlash(null), 1600);
  }

  const allowed = at <= reached + 5;

  return (
    <div className="tc-layer" onClick={(e) => e.stopPropagation()}>
      <div className={`tc-tools${raised ? ' show' : ''}`}>
        {signedIn ? (
          <button type="button" className="tc-btn" onClick={openBox} aria-label="Comment on this scene" title="Comment on this scene">💬</button>
        ) : (
          <Link href={loginHref} className="tc-btn" aria-label="Sign in to comment" title="Sign in to comment">💬</Link>
        )}
        <button type="button" className={`tc-btn small${on ? '' : ' off'}`} onClick={toggleBubbles} aria-pressed={on} title={on ? 'Hide comment pop-ups' : 'Show comment pop-ups'}>
          {on ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className={`tc-bubbles${raised ? ' raised' : ''}`} aria-live="polite" hidden={open}>
        {bubbles.map((b) => (
          <div key={b.key} className="tc-bubble">
            <b>{b.mine ? 'You' : b.author}</b> {b.body}
            {b.replies > 0 && <span className="tc-replies"> · {b.replies} repl{b.replies === 1 ? 'y' : 'ies'}</span>}
          </div>
        ))}
      </div>

      {flash && <div className="tc-flash">{flash}</div>}

      {open && (
        <form className="tc-box" onSubmit={post}>
          <div className="tc-box-head">
            <b>Comment at {clockLabel(at)}</b>
            <button type="button" className="tc-x" onClick={close} aria-label="Close">×</button>
          </div>
          {allowed ? (
            <>
              <input
                autoFocus className="input" maxLength={300} value={text} onChange={(e) => setText(e.target.value)}
                placeholder="What do you think of this scene?" aria-label="Your comment"
              />
              {err && <p className="tc-err">{err}</p>}
              <div className="tc-box-foot">
                <span>Others see it when they reach {clockLabel(at)}. No spoilers!</span>
                <button className="btn btn-accent btn-small" disabled={busy || !text.trim()}>{busy ? 'Posting…' : 'Post'}</button>
              </div>
            </>
          ) : (
            <p className="tc-err">
              You can comment on scenes up to <b>{clockLabel(reached)}</b>, the part you&rsquo;ve watched without skipping.
              Go back to {clockLabel(reached)} and keep watching to comment further.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
