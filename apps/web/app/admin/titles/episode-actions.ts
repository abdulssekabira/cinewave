'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export type EpState = { error?: string; message?: string; id?: string };

function done(titleId: string) {
  revalidatePath(`/admin/titles/${titleId}`);
  revalidatePath('/', 'layout');
}

const t = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Adds the next part (Part N+1 of the chosen season). */
export async function addEpisode(titleId: string, _: EpState, form: FormData): Promise<EpState> {
  const { sb } = await requireStaff();
  const season = Math.max(1, Math.min(99, Number(t(form, 'season')) || 1));
  const { data: last } = await sb.from('episodes').select('number').eq('title_id', titleId).eq('season', season)
    .order('number', { ascending: false }).limit(1).maybeSingle();
  const number = (last?.number ?? 0) + 1;
  const { data, error } = await sb.from('episodes').insert({
    title_id: titleId, season, number, name: t(form, 'name') || null,
  }).select('id').single();
  if (error) return { error: error.message };
  // A title with parts is a series.
  await sb.from('titles').update({ kind: 'series' }).eq('id', titleId);
  done(titleId);
  return { message: `Added Part ${number}. Now upload its video.`, id: data.id };
}

export async function saveEpisode(titleId: string, episodeId: string, _: EpState, form: FormData): Promise<EpState> {
  const { sb } = await requireStaff();
  const number = Number(t(form, 'number'));
  const season = Number(t(form, 'season')) || 1;
  if (!Number.isInteger(number) || number < 1 || number > 999) return { error: 'Part number must be between 1 and 999.' };
  const runtimeRaw = t(form, 'runtime_minutes');
  const runtime = runtimeRaw ? Number(runtimeRaw) : null;
  if (runtime !== null && (!Number.isInteger(runtime) || runtime < 1 || runtime > 1000)) return { error: 'Runtime must be a whole number of minutes.' };
  const { error } = await sb.from('episodes').update({
    number, season,
    name: t(form, 'name') || null,
    synopsis: t(form, 'synopsis') || null,
    runtime_minutes: runtime,
    still_url: t(form, 'still_url') || null,
  }).eq('id', episodeId);
  if (error) {
    if (error.code === '23505') return { error: `Season ${season} already has a Part ${number}.` };
    return { error: error.message };
  }
  done(titleId);
  return { message: 'Saved.' };
}

export async function setEpisodePublished(titleId: string, episodeId: string, published: boolean) {
  const { sb } = await requireStaff();
  await sb.from('episodes').update({ published }).eq('id', episodeId);
  done(titleId);
}

export async function deleteEpisode(titleId: string, episodeId: string) {
  const { sb } = await requireStaff();
  await sb.from('episodes').delete().eq('id', episodeId);
  done(titleId);
}
