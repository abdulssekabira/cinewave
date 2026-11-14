'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  clockLabel, deleteMyTimedComment, getTimedReplies, postTimedComment, reportTimedComment, timeAgo,
  type TimedComment, type TimedReply,
} from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';
import { getTimed, refreshTimed, setTimed, useTimed } from '@/lib/timed-store';

/**
 * Under the player: comments up to the furthest point watched on this page,
 * newest scene first. Replies open under each comment.
 */
export function TimedCommentList({ signedIn, loginHref }: { signedIn: boolean; loginHref: string }) {
  const maxTime = useTimed((s) => s.maxTime);
  const reached = useTimed((s) => s.reached);
  const open1st = useTimed((s) => s.open);
  const comments = useTimed((s) => s.comments);
  const visible = comments.filter((c) => c.at_seconds <= maxTime + 1).slice().reverse();

  return (
    <section className="tcl" aria-labelledby="tcl-h">
      <h2 className="section-h" id="tcl-h">
        Scene comments {visible.length > 0 && <span className="parts-count">{visible.length}</span>}
      </h2>
      <p className="rv-note" style={{ marginTop: -6 }}>
        Comments appear as you reach each moment, so nothing is spoiled.{' '}
        {signedIn
          ? <>Tap and hold the screen (or tap 💬) on any scene to comment on it.</>
          : <><Link href={loginHref}>Sign in</Link> to comment and reply.</>}
      </p>
      {signedIn && open1st && reached + 30 < maxTime && (
        <p className="rv-note">You can comment and reply up to <b>{clockLabel(reached)}</b>, the part you&rsquo;ve watched without skipping.</p>
      )}
      {signedIn && !open1st && (
        <p className="rv-note">You&rsquo;ve already watched this, so comments and replies are closed for you. They&rsquo;re open only during your first time watching.</p>
      )}
      {visible.length === 0 ? (
        <p className="rv-note">No comments up to this point yet.</p>
      ) : (
        <ul className="rv-list">
          {visible.map((c) => <Item key={c.id} c={c} signedIn={signedIn} canReply={signedIn && open1st && c.at_seconds <= reached + 5} />)}
        </ul>
      )}
    </section>
  );
}

function Item({ c, signedIn, canReply }: { c: TimedComment; signedIn: boolean; canReply: boolean }) {
  const sb = browserClient();
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<TimedReply[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  async function load() {
    setReplies(await getTimedReplies(sb, c.id).catch(() => []));
  }
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && replies === null) load();
  }
  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const s = getTimed();
    const r = await postTimedComment(sb, s.titleId!, s.episodeId, c.at_seconds, text, c.id);
    setBusy(false);
    if (r) { setErr(r); return; }
    setText(''); setErr(null);
    setTimed({ commented: true });
    await load();
    refreshTimed();
  }
  async function remove(id: string, isReply: boolean) {
    if (!window.confirm('Delete your comment?')) return;
    await deleteMyTimedComment(sb, id);
    if (isReply) load(); else refreshTimed();
  }
  async function report(id: string) {
    await reportTimedComment(sb, id);
    setReported((x) => new Set(x).add(id));
  }

  const count = replies?.length ?? c.replies;
  return (
    <li className={`rv-item${c.mine ? ' mine' : ''}`}>
      <div className="rv-head">
        <span className="tc-at">{clockLabel(c.at_seconds)}</span>
        <b>{c.mine ? 'You' : c.author}</b>
        <span className="rv-date">{timeAgo(c.created_at)}</span>
      </div>
      <p className="rv-body">{c.body}</p>
      <div className="rv-tools">
        {(open || count > 0 || canReply) && (
          <button type="button" onClick={toggle}>{open ? 'Hide replies' : count ? `${count} repl${count === 1 ? 'y' : 'ies'}` : 'Reply'}</button>
        )}
        {c.mine
          ? <button type="button" onClick={() => remove(c.id, false)}>Delete</button>
          : signedIn && (reported.has(c.id) ? <span>Reported</span> : <button type="button" onClick={() => report(c.id)}>Report</button>)}
      </div>
      {open && (
        <div className="tc-thread">
          {replies === null ? <p className="rv-note">Loading…</p> : replies.map((r) => (
            <div key={r.id} className="tc-reply">
              <div className="rv-head"><b>{r.mine ? 'You' : r.author}</b><span className="rv-date">{timeAgo(r.created_at)}</span></div>
              <p className="rv-body">{r.body}</p>
              <div className="rv-tools">
                {r.mine
                  ? <button type="button" onClick={() => remove(r.id, true)}>Delete</button>
                  : signedIn && (reported.has(r.id) ? <span>Reported</span> : <button type="button" onClick={() => report(r.id)}>Report</button>)}
              </div>
            </div>
          ))}
          {canReply ? (
            <form className="tc-reply-form" onSubmit={reply}>
              <input className="input" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" aria-label="Your reply" />
              <button className="btn btn-accent btn-small" disabled={busy || !text.trim()}>{busy ? '…' : 'Reply'}</button>
              {err && <p className="tc-err" style={{ gridColumn: '1 / -1' }}>{err}</p>}
            </form>
          ) : signedIn && getTimed().open ? (
            <p className="rv-note">Watch up to {clockLabel(c.at_seconds)} without skipping to reply.</p>
          ) : null}
        </div>
      )}
    </li>
  );
}
