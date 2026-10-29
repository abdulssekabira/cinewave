'use client';

import { useActionState } from 'react';
import type { Genre, Vj } from '@cinewave/shared';
import { saveTitle, type FormState } from '@/app/admin/titles/actions';
import type { AdminTitle } from '@/lib/admin';
import { ImageUpload } from './ImageUpload';

export function TitleForm({ title, genres, selectedGenres, vjs }: { title: AdminTitle | null; genres: Genre[]; selectedGenres: string[]; vjs: Vj[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTitle, {});
  const t = title;
  const credits = (t?.credits ?? []).map((c) => `${c.name}, ${c.role}`).join('\n');

  return (
    <form action={action} className="a-form">
      {t && <input type="hidden" name="id" value={t.id} />}
      {state.error && <div className="form-msg error" role="alert">{state.error}</div>}

      <div className="a-cols">
        <div className="a-col-main">
          <section className="a-card">
            <h2>Details</h2>
            <div className="a-field">
              <label htmlFor="f-title">Title *</label>
              <input id="f-title" name="title" className="input" required defaultValue={t?.title ?? ''} />
            </div>
            <div className="a-field">
              <label htmlFor="f-slug">Web address</label>
              <div className="a-prefix"><span>/title/</span><input id="f-slug" name="slug" className="input" defaultValue={t?.slug ?? ''} placeholder="made from the title if empty" /></div>
            </div>
            <div className="a-field">
              <label htmlFor="f-tagline">Tagline</label>
              <input id="f-tagline" name="tagline" className="input" defaultValue={t?.tagline ?? ''} placeholder="One short line" />
            </div>
            <div className="a-field">
              <label htmlFor="f-synopsis">Synopsis</label>
              <textarea id="f-synopsis" name="synopsis" className="input" rows={5} defaultValue={t?.synopsis ?? ''} />
            </div>
            <div className="a-grid3">
              <div className="a-field">
                <label htmlFor="f-year">Year</label>
                <input id="f-year" name="release_year" className="input" inputMode="numeric" defaultValue={t?.release_year ?? ''} />
              </div>
              <div className="a-field">
                <label htmlFor="f-runtime">Runtime (minutes)</label>
                <input id="f-runtime" name="runtime_minutes" className="input" inputMode="numeric" defaultValue={t?.runtime_minutes ?? ''} />
              </div>
              <div className="a-field">
                <label htmlFor="f-age">Age rating</label>
                <input id="f-age" name="maturity_rating" className="input" defaultValue={t?.maturity_rating ?? ''} placeholder="e.g. PG, 13+, 18+" />
              </div>
            </div>

            <div className="a-field">
              <label htmlFor="f-vj">VJ</label>
              <select id="f-vj" name="vj_id" className="select input" defaultValue={t?.vj_id ? String(t.vj_id) : ''}>
                <option value="">No VJ (original language)</option>
                {vjs.map((v) => <option key={v.id} value={v.id}>{v.name}{v.active ? '' : ' (hidden)'}</option>)}
              </select>
              <small className="a-hint">Add or rename VJs in Admin → VJs &amp; genres.</small>
            </div>

            <fieldset className="a-field">
              <legend>Genres</legend>
              <div className="a-checks">
                {genres.map((g) => (
                  <label key={g.slug} className="a-check">
                    <input type="checkbox" name="genres" value={g.slug} defaultChecked={selectedGenres.includes(g.slug)} />
                    {g.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="a-field">
              <label htmlFor="f-credits">Cast &amp; crew</label>
              <textarea id="f-credits" name="credits" className="input" rows={4} defaultValue={credits} placeholder={'One per line: Name, Role\nJane Doe, Director\nJohn Doe, Cast'} />
            </div>
          </section>

          <section className="a-card">
            <h2>Languages &amp; content</h2>
            <div className="a-grid3">
              <div className="a-field">
                <label htmlFor="f-lang">Original language</label>
                <input id="f-lang" name="original_language" className="input" defaultValue={t?.original_language ?? 'en'} />
              </div>
              <div className="a-field">
                <label htmlFor="f-audio">Audio</label>
                <input id="f-audio" name="audio_languages" className="input" defaultValue={t?.audio_languages.join(', ') ?? 'en'} placeholder="en, lg" />
              </div>
              <div className="a-field">
                <label htmlFor="f-subs">Subtitles</label>
                <input id="f-subs" name="subtitle_languages" className="input" defaultValue={t?.subtitle_languages.join(', ') ?? ''} placeholder="en, lg, sw" />
              </div>
            </div>
            <small className="a-hint">Language codes separated by commas: en English, lg Luganda, sw Swahili, nyn Runyankore, ach Acholi.</small>
            <div className="a-field" style={{ marginTop: 14 }}>
              <label htmlFor="f-warn">Content warnings</label>
              <input id="f-warn" name="content_warnings" className="input" defaultValue={t?.content_warnings.join(', ') ?? ''} placeholder="violence, strong language" />
            </div>
          </section>
        </div>

        <div className="a-col-side">
          <section className="a-card">
            <h2>Publishing</h2>
            <div className="a-field">
              <label htmlFor="f-status">Status</label>
              <select id="f-status" name="status" className="select" defaultValue={t?.status ?? 'draft'}>
                <option value="draft">Draft — hidden</option>
                <option value="published">Published</option>
                <option value="archived">Archived — removed</option>
              </select>
              <small className="a-hint">Published films appear only while they have an active rights window.</small>
            </div>
            <div className="a-field">
              <label htmlFor="f-plan">Who can watch</label>
              <select id="f-plan" name="required_plan" className="select" defaultValue={t?.required_plan ?? 'free'}>
                <option value="free">Everyone (free, with ads)</option>
                <option value="standard">Standard and Premium</option>
                <option value="premium">Premium only</option>
              </select>
            </div>
            <label className="a-check">
              <input type="checkbox" name="is_featured" defaultChecked={t?.is_featured ?? false} />
              Feature on the home page hero
            </label>
            <div className="a-field" style={{ marginTop: 12 }}>
              <label htmlFor="f-pop">Popularity (sort order)</label>
              <input id="f-pop" name="popularity" className="input" inputMode="numeric" defaultValue={t?.popularity ?? 0} />
              <small className="a-hint">Higher shows first in Trending.</small>
            </div>
          </section>

          <section className="a-card">
            <h2>Artwork</h2>
            <ImageUpload name="poster_url" label="Poster" shape="poster" initial={t?.poster_url ?? null} hint="Portrait 2:3, e.g. 1000×1500 px." />
            <ImageUpload name="backdrop_url" label="Backdrop" shape="wide" initial={t?.backdrop_url ?? null} hint="Landscape 16:9, e.g. 1920×1080 px, no text. Used for the hero." />
            <div className="a-field">
              <label htmlFor="f-trailer">Trailer link</label>
              <input id="f-trailer" name="trailer_url" className="input" type="url" defaultValue={t?.trailer_url ?? ''} placeholder="https://" />
            </div>
          </section>

          <section className="a-card">
            <h2>Rating</h2>
            <div className="a-grid2 tight">
              <div className="a-field">
                <label htmlFor="f-rating">Score / 10</label>
                <input id="f-rating" name="rating" className="input" inputMode="decimal" defaultValue={t?.rating ?? ''} />
              </div>
              <div className="a-field">
                <label htmlFor="f-rsrc">Source</label>
                <input id="f-rsrc" name="rating_source" className="input" defaultValue={t?.rating_source ?? ''} placeholder="GLE Movies viewers" />
              </div>
            </div>
            <small className="a-hint">Leave empty if you don’t have a real rating. Never copy scores you aren’t licensed to show.</small>
          </section>
        </div>
      </div>

      <div className="a-savebar">
        <button className="btn btn-accent" disabled={pending}>{pending ? 'Saving…' : t ? 'Save changes' : 'Create film'}</button>
      </div>
    </form>
  );
}
