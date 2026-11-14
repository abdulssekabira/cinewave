'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  deleteMyReview, getReviewSummary, getReviews, reportReview, saveReview, timeAgo,
  type Review, type ReviewSummary,
} from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

const PAGE = 10;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="rv-stars" style={{ fontSize: size }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>)}
    </span>
  );
}

/**
 * Viewer reviews: average + star bars, a form for viewers who have watched it,
 * and the list (own review first). Loads in the browser so it can sit on any page.
 */
export function Reviews({ titleId, slug, signedIn, compact }: { titleId: string; slug: string; signedIn: boolean; compact?: boolean }) {
  const sb = browserClient();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [list, setList] = useState<Review[]>([]);
  const [more, setMore] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [s, l] = await Promise.all([getReviewSummary(sb, titleId), getReviews(sb, titleId, 0, PAGE)]);
    setSummary(s);
    setList(l);
    setMore(l.length === PAGE);
    const mine = l.find((r) => r.mine);
    setStars(mine?.stars ?? 0);
    setText(mine?.body ?? '');
  }, [sb, titleId]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  // Watching on the same page: once they've seen a minute, the form appears.
  const waiting = Boolean(summary && !summary.canReview && signedIn);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => { getReviewSummary(sb, titleId).then((x) => { if (x.canReview) setSummary(x); }).catch(() => {}); }, 45000);
    return () => clearInterval(t);
  }, [waiting, titleId, sb]);

  const mine = list.find((r) => r.mine) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stars) { setMsg({ error: 'Tap the stars to choose your rating.' }); return; }
    setBusy(true);
    const err = await saveReview(sb, titleId, stars, text);
    setBusy(false);
    if (err) { setMsg({ error: err }); return; }
    setMsg({ ok: mine ? 'Your review was updated.' : 'Thanks! Your review is posted.' });
    setEditing(false);
    load().catch(() => {});
  }

  async function remove() {
    if (!window.confirm('Delete your review?')) return;
    await deleteMyReview(sb, titleId).catch(() => {});
    setStars(0); setText(''); setMsg({ ok: 'Your review was deleted.' });
    load().catch(() => {});
  }

  async function report(id: string) {
    await reportReview(sb, id).catch(() => {});
    setReported((s) => new Set(s).add(id));
  }

  async function loadMore() {
    const l = await getReviews(sb, titleId, list.length, PAGE).catch(() => []);
    setList((x) => [...x, ...l]);
    setMore(l.length === PAGE);
  }

  if (!summary) return null;
  const max = Math.max(1, ...summary.counts);
  const showForm = summary.canReview && (!mine || editing);

  return (
    <section className={`reviews${compact ? ' compact' : ''}`} aria-labelledby={`rv-h-${titleId}`}>
      <h2 className="section-h" id={`rv-h-${titleId}`}>Reviews {summary.total > 0 && <span className="parts-count">{summary.total}</span>}</h2>

      {summary.total > 0 && (
        <div className="rv-summary">
          <div className="rv-avg">
            <b>{summary.average?.toFixed(1)}</b>
            <Stars value={summary.average ?? 0} size={18} />
            <span>{summary.total} review{summary.total === 1 ? '' : 's'}</span>
          </div>
          <div className="rv-bars" aria-hidden="true">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="rv-bar">
                <span>{n}★</span>
                <div><i style={{ width: `${(summary.counts[n - 1] / max) * 100}%` }} /></div>
                <span>{summary.counts[n - 1]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg.error && <div className="form-msg error" role="alert">{msg.error}</div>}
      {msg.ok && <div className="form-msg ok" role="status">{msg.ok}</div>}

      {showForm ? (
        <form className="rv-form" onSubmit={submit}>
          <div className="rv-pick" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
            <span className="rv-pick-label">{mine ? 'Change your rating' : 'Rate it'}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                className={n <= (hover || stars) ? 'on' : ''}
                onMouseEnter={() => setHover(n)} onClick={() => { setStars(n); setMsg({}); }}
              >★</button>
            ))}
          </div>
          <textarea
            className="input" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="What did you think? (optional)" aria-label="Your review"
          />
          <div className="rv-actions">
            <button className="btn btn-accent btn-small" disabled={busy}>{busy ? 'Posting…' : mine ? 'Save' : 'Post review'}</button>
            {editing && <button type="button" className="btn btn-gray btn-small" onClick={() => setEditing(false)}>Cancel</button>}
            <span className="rv-count">{text.length}/1000</span>
          </div>
        </form>
      ) : !signedIn ? (
        <p className="rv-note"><Link href={`/login?next=/title/${slug}`}>Sign in</Link> to rate and review after watching.</p>
      ) : !summary.canReview ? (
        <p className="rv-note">Watch it first, then come back to rate it and share your view.</p>
      ) : null}

      {list.length === 0 ? (
        <p className="rv-note">No reviews yet. {summary.canReview ? 'Be the first!' : ''}</p>
      ) : (
        <ul className="rv-list">
          {list.map((r) => (
            <li key={r.id} className={`rv-item${r.mine ? ' mine' : ''}`}>
              <div className="rv-head">
                <span className="rv-avatar" aria-hidden="true">{r.author.slice(0, 1).toUpperCase()}</span>
                <b>{r.mine ? 'You' : r.author}</b>
                <Stars value={r.stars} size={13} />
                <span className="rv-date">{timeAgo(r.created_at)}{r.updated_at !== r.created_at ? ' · edited' : ''}</span>
              </div>
              {r.body && <p className="rv-body">{r.body}</p>}
              <div className="rv-tools">
                {r.mine ? (
                  <>
                    <button type="button" onClick={() => { setEditing(true); setMsg({}); }}>Edit</button>
                    <button type="button" onClick={remove}>Delete</button>
                  </>
                ) : signedIn ? (
                  reported.has(r.id)
                    ? <span>Reported. Thank you.</span>
                    : <button type="button" onClick={() => report(r.id)}>Report</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {more && <button type="button" className="btn btn-gray btn-small" onClick={loadMore}>Show more reviews</button>}
    </section>
  );
}
