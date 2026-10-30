'use client';

import { useState, useTransition } from 'react';
import { deleteTitle } from '@/app/admin/titles/actions';

/** Owner-only. Two taps so nothing is deleted by accident. */
export function DeleteTitle({ titleId, name }: { titleId: string; name: string }) {
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="a-card" style={{ marginTop: 24 }}>
      <h2>Delete film</h2>
      <p className="a-muted" style={{ marginTop: -4 }}>
        Removes “{name}” for good: its video, parts, rights, viewers’ progress and downloads. This can’t be undone.
        To just hide it, set Status to Draft or Archived instead.
      </p>
      {error && <div className="form-msg error" role="alert">{error}</div>}
      {sure ? (
        <div className="a-row">
          <button
            type="button"
            className="btn btn-accent btn-small"
            disabled={pending}
            onClick={() => start(async () => { const r = await deleteTitle(titleId); if (r?.error) setError(r.error); })}
          >
            {pending ? 'Deleting…' : `Yes, delete “${name}”`}
          </button>
          <button type="button" className="btn btn-gray btn-small" onClick={() => setSure(false)} disabled={pending}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="btn btn-gray btn-small" onClick={() => setSure(true)}>Delete film…</button>
      )}
    </section>
  );
}
