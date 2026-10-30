'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { kampalaDay, requireStaff, slugify } from '@/lib/admin';
import { deleteObject, r2Configured } from '@/lib/r2';
import { deleteMuxAsset, muxConfigured } from '@/lib/mux';

export type FormState = { error?: string; message?: string };

const PLANS = ['free', 'standard', 'premium'];
const STATUSES = ['draft', 'published', 'archived'];

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optText = (f: FormData, k: string) => text(f, k) || null;
const list = (f: FormData, k: string) =>
  text(f, k).split(',').map((s) => s.trim()).filter(Boolean);

function optInt(f: FormData, k: string, min: number, max: number, label: string) {
  const v = text(f, k);
  if (!v) return { value: null as number | null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) return { error: `${label} must be a whole number between ${min} and ${max}.` };
  return { value: n };
}

/** "Name, Role" per line → [{ name, role }]. Role defaults to Cast. */
function parseCredits(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.split(/\s*(?:,|—|–| - )\s*/);
      const name = m[0]?.trim();
      const role = m.slice(1).join(' ').trim() || 'Cast';
      return name ? { name, role } : null;
    })
    .filter(Boolean);
}

export async function saveTitle(_: FormState, form: FormData): Promise<FormState> {
  const { sb } = await requireStaff();
  const id = text(form, 'id');
  const title = text(form, 'title');
  if (!title) return { error: 'Give the film a title.' };

  const slug = slugify(text(form, 'slug') || title);
  if (!slug) return { error: 'The web address needs at least one letter or number.' };

  const year = optInt(form, 'release_year', 1880, 2100, 'Year');
  const runtime = optInt(form, 'runtime_minutes', 1, 1000, 'Runtime');
  const popularity = optInt(form, 'popularity', 0, 1_000_000, 'Popularity');
  for (const r of [year, runtime, popularity]) if ('error' in r) return { error: r.error };

  const ratingRaw = text(form, 'rating');
  let rating: number | null = null;
  if (ratingRaw) {
    rating = Number(ratingRaw);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) return { error: 'Rating must be between 0 and 10.' };
  }
  const ratingSource = optText(form, 'rating_source');
  if (rating !== null && !ratingSource) return { error: 'Say where the rating comes from (for example “GLE Movies viewers”).' };

  const plan = text(form, 'required_plan');
  const status = text(form, 'status');
  if (!PLANS.includes(plan) || !STATUSES.includes(status)) return { error: 'Choose a plan and status.' };

  const row = {
    title,
    slug,
    tagline: optText(form, 'tagline'),
    synopsis: optText(form, 'synopsis'),
    release_year: year.value,
    runtime_minutes: runtime.value,
    maturity_rating: optText(form, 'maturity_rating'),
    original_language: optText(form, 'original_language')?.toLowerCase() ?? 'en',
    audio_languages: list(form, 'audio_languages').map((l) => l.toLowerCase()),
    subtitle_languages: list(form, 'subtitle_languages').map((l) => l.toLowerCase()),
    content_warnings: list(form, 'content_warnings'),
    credits: parseCredits(text(form, 'credits')),
    poster_url: optText(form, 'poster_url'),
    backdrop_url: optText(form, 'backdrop_url'),
    trailer_url: optText(form, 'trailer_url'),
    required_plan: plan,
    status,
    is_featured: form.get('is_featured') === 'on',
    popularity: popularity.value ?? 0,
    rating,
    rating_source: rating === null ? null : ratingSource,
    vj_id: Number(text(form, 'vj_id')) || null,
    kind: text(form, 'kind') === 'series' ? 'series' : 'movie',
  };

  const res = id
    ? await sb.from('titles').update(row).eq('id', id).select('id').single()
    : await sb.from('titles').insert(row).select('id').single();
  if (res.error) {
    if (res.error.code === '23505') return { error: `The web address “${slug}” is already used by another film.` };
    return { error: res.error.message };
  }
  const titleId = res.data.id as string;

  // Genres: replace the set.
  const genreSlugs = form.getAll('genres').map(String);
  await sb.from('title_genres').delete().eq('title_id', titleId);
  if (genreSlugs.length) {
    const { data: g } = await sb.from('genres').select('id, slug').in('slug', genreSlugs);
    if (g?.length) {
      const { error } = await sb.from('title_genres').insert(g.map((x) => ({ title_id: titleId, genre_id: x.id })));
      if (error) return { error: error.message };
    }
  }

  revalidatePath('/', 'layout');
  redirect(`/admin/titles/${titleId}?saved=1`);
}

export async function addRights(titleId: string, _: FormState, form: FormData): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only administrators can change rights.' };

  const contract = text(form, 'contract_ref');
  if (!contract) return { error: 'Enter the contract or agreement reference.' };

  let territories = ['*'];
  if (text(form, 'scope') === 'countries') {
    territories = [...new Set((text(form, 'countries').toUpperCase().match(/[A-Z]{2}/g) ?? []))];
    if (!territories.length) return { error: 'List at least one 2-letter country code, e.g. UG.' };
  }

  const start = text(form, 'starts_on');
  const end = text(form, 'ends_on');
  if (!start) return { error: 'Choose a start date.' };
  if (end && end <= start) return { error: 'The end date must be after the start date.' };

  const allowDownload = form.get('allow_download') === 'on';
  const expiry = optInt(form, 'download_expiry_hours', 1, 24 * 365, 'Download expiry');
  if ('error' in expiry) return { error: expiry.error };

  const { error } = await sb.from('rights').insert({
    title_id: titleId,
    partner_id: optText(form, 'partner_id'),
    contract_ref: contract,
    territories,
    starts_at: kampalaDay(start),
    ends_at: end ? kampalaDay(end) : null,
    allow_stream: true,
    allow_download: allowDownload,
    allow_ads: form.get('allow_ads') === 'on',
    download_expiry_hours: allowDownload ? expiry.value : null,
    notes: optText(form, 'notes'),
  });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { message: 'Rights window added.' };
}

export async function endRights(rightsId: string, titleId: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('rights').update({ ends_at: new Date().toISOString() }).eq('id', rightsId);
  revalidatePath('/', 'layout');
  redirect(`/admin/titles/${titleId}`);
}

export async function deleteRights(rightsId: string, titleId: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('rights').delete().eq('id', rightsId);
  revalidatePath('/', 'layout');
  redirect(`/admin/titles/${titleId}`);
}

/**
 * Deletes a film or series for good (owner only): its parts, rights,
 * progress, downloads and its video files in storage.
 */
export async function deleteTitle(titleId: string): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only the owner can delete films.' };
  const { data: media } = await sb.from('media_assets').select('provider, asset_id, playback_id, upload_id').eq('title_id', titleId);
  const { error } = await sb.from('titles').delete().eq('id', titleId);
  if (error) return { error: error.message };
  // Remove the files too, so storage isn't paid for deleted films.
  for (const m of media ?? []) {
    try {
      if (m.provider === 'r2' && r2Configured() && m.asset_id) {
        await deleteObject(m.asset_id, m.upload_id);
        if (m.playback_id && m.playback_id !== m.asset_id) await deleteObject(m.playback_id);
      } else if (m.provider === 'mux' && muxConfigured() && m.asset_id) {
        await deleteMuxAsset(m.asset_id);
      }
    } catch { /* the film is gone; a leftover file can be cleaned later */ }
  }
  revalidatePath('/', 'layout');
  redirect('/admin/titles?deleted=1');
}
