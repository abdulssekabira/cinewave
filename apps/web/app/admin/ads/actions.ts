'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export type AdState = { error?: string; message?: string };
const t = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function saveAd(_: AdState, form: FormData): Promise<AdState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only the owner can manage adverts.' };
  const id = t(form, 'id');
  const link = t(form, 'link_url');
  if (link && !/^https?:\/\//i.test(link)) return { error: 'The link must start with https://' };
  const row = {
    name: t(form, 'name').slice(0, 80),
    headline: t(form, 'headline').slice(0, 70),
    subtext: t(form, 'subtext').slice(0, 110) || null,
    image_url: t(form, 'image_url') || null,
    link_url: link || null,
    cta: t(form, 'cta').slice(0, 18) || 'Visit',
    starts_at: t(form, 'starts_at') ? new Date(t(form, 'starts_at')).toISOString() : new Date().toISOString(),
    ends_at: t(form, 'ends_at') ? new Date(`${t(form, 'ends_at')}T23:59:59+03:00`).toISOString() : null,
    weight: Math.min(10, Math.max(1, Number(t(form, 'weight')) || 1)),
  };
  if (!row.name || !row.headline) return { error: 'Give the advert a name (for you) and a headline (what viewers read).' };
  const { error } = id ? await sb.from('ads').update(row).eq('id', id) : await sb.from('ads').insert(row);
  if (error) return { error: error.message };
  revalidatePath('/admin/ads');
  return { message: id ? 'Advert saved.' : 'Advert added. Free viewers will start seeing it.' };
}

export async function setAdActive(id: string, on: boolean) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('ads').update({ active: on }).eq('id', id);
  revalidatePath('/admin/ads');
}

export async function deleteAd(id: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('ads').delete().eq('id', id);
  revalidatePath('/admin/ads');
}

export async function saveAdTiming(_: AdState, form: FormData): Promise<AdState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only the owner can change this.' };
  const n = (k: string, min: number, max: number) => {
    const v = Number(t(form, k));
    return Number.isFinite(v) && v >= min && v <= max ? v : null;
  };
  const first = n('ad_first_after_min', 0, 120), every = n('ad_every_min', 1, 120), show = n('ad_show_sec', 5, 60);
  if (first === null || every === null || show === null) return { error: 'Use numbers: first advert 0–120 min, every 1–120 min, show for 5–60 seconds.' };
  const now = new Date().toISOString();
  const { error } = await sb.from('site_settings').upsert([
    { key: 'ad_first_after_min', value: String(first), updated_at: now },
    { key: 'ad_every_min', value: String(every), updated_at: now },
    { key: 'ad_show_sec', value: String(show), updated_at: now },
  ], { onConflict: 'key' });
  if (error) return { error: error.message };
  revalidatePath('/admin/ads');
  return { message: 'Timing saved.' };
}
