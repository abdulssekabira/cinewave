'use client';

import { useActionState, useState } from 'react';
import type { Episode } from '@cinewave/shared';
import { addEpisode, deleteEpisode, saveEpisode, setEpisodePublished, type EpState } from '@/app/admin/titles/episode-actions';
import type { VideoState } from '@/app/admin/titles/video-actions';
import { VideoUpload } from './VideoUpload';
import { ImageUpload } from './ImageUpload';

type Row = Episode & { video: VideoState };

/** Parts of a series: add parts, upload each part's video, edit, hide, delete. */
export function EpisodeManager({ titleId, episodes, connected, canPublish = true, storage = 'mux' }: { titleId: string; episodes: Row[]; connected: boolean; canPublish?: boolean; storage?: 'mux' | 'r2' }) {
  const seasons = [...new Set(episodes.map((e) => e.season))];
  const multi = seasons.length > 1;
  const lastSeason = seasons.length ? Math.max(...seasons) : 1;
  const [state, action, pending] = useActionState<EpState, FormData>(addEpisode.bind(null, titleId), {});
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      {episodes.length === 0 ? (
        <p className="a-muted">No parts yet. Add Part 1 below, then upload its video.</p>
      ) : (
        <ul className="ep-list">
          {episodes.map((e) => (
            <EpisodeRow
              key={e.id}
              titleId={titleId}
              ep={e}
              canPublish={canPublish}
              storage={storage}
              multi={multi}
              connected={connected}
              open={openId === e.id || state.id === e.id}
              onToggle={() => setOpenId((v) => (v === e.id ? null : e.id))}
            />
          ))}
        </ul>
      )}

      <form action={action} className="ep-add">
        {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
        {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
        <div className="a-grid2 tight">
          <div className="a-field">
            <label htmlFor="ep-new-name">Next part’s name (optional)</label>
            <input id="ep-new-name" name="name" className="input" placeholder="e.g. The Return" maxLength={120} />
          </div>
          <div className="a-field">
            <label htmlFor="ep-new-season">Season</label>
            <input id="ep-new-season" name="season" type="number" min={1} max={99} className="input" defaultValue={lastSeason} />
          </div>
        </div>
        <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Adding…' : '+ Add part'}</button>
        <small className="a-hint" style={{ display: 'block', marginTop: 8 }}>
          Parts are numbered automatically (Part 1, Part 2…). Use Season only if the series has more than one season.
        </small>
      </form>
    </div>
  );
}

function EpisodeRow({
  titleId, ep, multi, connected, open, onToggle, canPublish, storage,
}: { titleId: string; ep: Row; multi: boolean; connected: boolean; open: boolean; onToggle: () => void; canPublish: boolean; storage: 'mux' | 'r2' }) {
  const locked = !canPublish && ep.published;
  const [state, action, pending] = useActionState<EpState, FormData>(saveEpisode.bind(null, titleId, ep.id), {});
  const [confirming, setConfirming] = useState(false);
  const label = `${multi ? `S${ep.season} · ` : ''}Part ${ep.number}`;
  const v = ep.video.status;
  const tone = v === 'ready' ? 'ok' : v === 'errored' ? 'warn' : 'muted';
  const vLabel = v === 'ready' ? 'Video ready' : v === 'none' ? 'No video' : v === 'errored' ? 'Video problem' : 'Video processing';

  return (
    <li className={`ep-item${ep.published ? '' : ' hidden-item'}`}>
      <button type="button" className="ep-head" onClick={onToggle} aria-expanded={open}>
        <span className="ep-num">{label}</span>
        <span className="ep-name">{ep.name ?? <span className="a-muted">No name</span>}</span>
        <span className={`a-badge ${tone}`}>{vLabel}</span>
        {!ep.published && <span className="a-badge muted">{canPublish ? 'Hidden' : 'Waiting for the owner'}</span>}
        <span aria-hidden="true" className="ep-chev">{open ? '▴' : '▾'}</span>
      </button>

      {open && locked && (
        <div className="ep-body"><p className="a-muted">This part is live. Only the owner can change it.</p></div>
      )}
      {open && !locked && (
        <div className="ep-body">
          <section>
            <h3 className="ep-sub">Video</h3>
            <VideoUpload titleId={titleId} episodeId={ep.id} initial={ep.video} connected={connected} storage={storage} compact />
          </section>

          <form action={action} className="ep-form">
            <h3 className="ep-sub">Details</h3>
            {state.error && <div className="form-msg error" role="alert">{state.error}</div>}
            {state.message && <div className="form-msg ok" role="status">{state.message}</div>}
            <div className="a-grid3">
              <div className="a-field">
                <label htmlFor={`ep-n-${ep.id}`}>Part number</label>
                <input id={`ep-n-${ep.id}`} name="number" type="number" min={1} max={999} className="input" defaultValue={ep.number} />
              </div>
              <div className="a-field">
                <label htmlFor={`ep-s-${ep.id}`}>Season</label>
                <input id={`ep-s-${ep.id}`} name="season" type="number" min={1} max={99} className="input" defaultValue={ep.season} />
              </div>
              <div className="a-field">
                <label htmlFor={`ep-r-${ep.id}`}>Runtime (min)</label>
                <input id={`ep-r-${ep.id}`} name="runtime_minutes" className="input" inputMode="numeric" defaultValue={ep.runtime_minutes ?? ''} placeholder="Filled from video" />
              </div>
            </div>
            <div className="a-field">
              <label htmlFor={`ep-name-${ep.id}`}>Name</label>
              <input id={`ep-name-${ep.id}`} name="name" className="input" defaultValue={ep.name ?? ''} maxLength={120} />
            </div>
            <div className="a-field">
              <label htmlFor={`ep-syn-${ep.id}`}>Short description</label>
              <textarea id={`ep-syn-${ep.id}`} name="synopsis" className="input" rows={2} defaultValue={ep.synopsis ?? ''} />
            </div>
            <ImageUpload name="still_url" label="Picture (optional)" hint="A wide 16:9 scene from this part. Without one, the series backdrop or poster is used." initial={ep.still_url} shape="wide" />
            <button className="btn btn-accent btn-small" disabled={pending}>{pending ? 'Saving…' : 'Save part'}</button>
          </form>

          <div className="a-row" style={{ marginTop: 14 }}>
            {canPublish ? (
              <button type="button" className="btn btn-gray btn-small" onClick={() => setEpisodePublished(titleId, ep.id, !ep.published)}>
                {ep.published ? 'Hide from viewers' : 'Show to viewers'}
              </button>
            ) : (
              <span className="a-muted">The owner shows this part to viewers.</span>
            )}
            {confirming ? (
              <button type="button" className="btn btn-accent btn-small" onClick={() => deleteEpisode(titleId, ep.id)}>Tap again to delete {label}</button>
            ) : (
              <button type="button" className="btn btn-gray btn-small" onClick={() => setConfirming(true)}>Delete part</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
