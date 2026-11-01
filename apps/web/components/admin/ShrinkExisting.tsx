'use client';

import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { ART_SIZE, shrinkImage } from '@/lib/shrink-image';

type Job = { table: 'titles' | 'vjs' | 'episodes'; id: string | number; column: string; url: string; shape: keyof typeof ART_SIZE };

/**
 * One-time tool: makes the posters, banners and VJ photos already uploaded
 * small enough to load fast (new uploads are shrunk automatically).
 */
export function ShrinkExisting() {
  const [state, setState] = useState<{ running: boolean; done: number; total: number; saved: number; skipped: number; note?: string }>({
    running: false, done: 0, total: 0, saved: 0, skipped: 0,
  });

  async function run() {
    const sb = browserClient();
    setState({ running: true, done: 0, total: 0, saved: 0, skipped: 0 });
    const [{ data: titles }, { data: vjs }, { data: eps }] = await Promise.all([
      sb.from('titles').select('id, poster_url, backdrop_url'),
      sb.from('vjs').select('id, photo_url'),
      sb.from('episodes').select('id, still_url'),
    ]);
    const jobs: Job[] = [];
    const ours = (u: string | null) => Boolean(u && u.includes('.supabase.co/storage/') && u.includes('/artwork/'));
    for (const t of titles ?? []) {
      if (ours(t.poster_url)) jobs.push({ table: 'titles', id: t.id, column: 'poster_url', url: t.poster_url, shape: 'poster' });
      if (ours(t.backdrop_url)) jobs.push({ table: 'titles', id: t.id, column: 'backdrop_url', url: t.backdrop_url, shape: 'wide' });
    }
    for (const v of vjs ?? []) if (ours(v.photo_url)) jobs.push({ table: 'vjs', id: v.id, column: 'photo_url', url: v.photo_url, shape: 'round' });
    for (const e of eps ?? []) if (ours(e.still_url)) jobs.push({ table: 'episodes', id: e.id, column: 'still_url', url: e.still_url, shape: 'wide' });

    let done = 0, saved = 0, skipped = 0;
    setState((s) => ({ ...s, total: jobs.length }));
    for (const j of jobs) {
      try {
        const res = await fetch(j.url, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (blob.size < 250 * 1024) { skipped++; continue; } // already small
        const small = await shrinkImage(blob, ART_SIZE[j.shape]);
        if (small.size >= blob.size * 0.9) { skipped++; continue; }
        const path = `${j.shape === 'round' ? 'vjs' : 'titles'}/opt-${j.column}-${j.id}-${Date.now()}.jpg`;
        const { error: upErr } = await sb.storage.from('artwork').upload(path, await small.arrayBuffer(), { contentType: 'image/jpeg', cacheControl: '31536000' });
        if (upErr) throw upErr;
        const url = sb.storage.from('artwork').getPublicUrl(path).data.publicUrl;
        const { error } = await sb.from(j.table).update({ [j.column]: url }).eq('id', j.id);
        if (error) throw error;
        saved += blob.size - small.size;
      } catch {
        skipped++;
      } finally {
        done++;
        setState((s) => ({ ...s, done, saved, skipped }));
      }
    }
    setState((s) => ({ ...s, running: false, note: 'Finished. Pages now load the smaller images.' }));
  }

  const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
  return (
    <section className="a-card" style={{ marginTop: 20 }}>
      <h2>Make images load faster</h2>
      <p className="a-muted" style={{ marginTop: -4 }}>
        Shrinks the posters, banners and VJ photos already uploaded to the size they’re shown at. They look the same but load much
        faster on TVs and phones. New uploads are shrunk automatically. Keep this page open while it runs.
      </p>
      {state.total > 0 && (
        <p style={{ margin: '8px 0' }}>
          {state.done} of {state.total} checked · {mb(state.saved)} saved{state.skipped ? ` · ${state.skipped} already small or skipped` : ''}
        </p>
      )}
      {state.note && <div className="form-msg ok" role="status">{state.note}</div>}
      <button type="button" className="btn btn-accent btn-small" onClick={run} disabled={state.running}>
        {state.running ? 'Working…' : state.total ? 'Run again' : 'Shrink existing images'}
      </button>
    </section>
  );
}
