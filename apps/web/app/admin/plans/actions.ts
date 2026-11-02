'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export type FormState = { error?: string; message?: string };

const QUALITIES = ['480p', '720p', '1080p'];
const t = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** Whole shillings: "10,000" → 10000. Empty → null. */
function money(f: FormData, k: string, label: string): { value: number | null } | { error: string } {
  const raw = t(f, k).replace(/[,\s]/g, '').replace(/^UGX/i, '');
  if (!raw) return { value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) return { error: `${label} must be a whole number of shillings.` };
  return { value: n };
}

export async function savePlan(_: FormState, form: FormData): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only administrators can change plans.' };

  const id = t(form, 'id');
  const name = t(form, 'name');
  if (!name) return { error: 'Give the plan a name.' };

  const quality = t(form, 'max_quality');
  if (!QUALITIES.includes(quality)) return { error: 'Choose a video quality.' };
  const devRaw = t(form, 'max_devices');
  const devices = devRaw ? Number(devRaw) : null;
  if (devices !== null && (!Number.isInteger(devices) || devices < 1 || devices > 20)) {
    return { error: 'Devices allowed must be between 1 and 20, or empty for no limit.' };
  }

  const patch: Record<string, unknown> = {
    name,
    description: t(form, 'description') || null,
    features: t(form, 'features').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 8),
    shows_ads: form.get('shows_ads') === 'on',
    max_quality: quality,
    max_devices: devices,
    downloads_allowed: form.get('downloads_allowed') === 'on',
  };

  if (id !== 'free') {
    const monthly = money(form, 'price', 'Monthly price');
    const weekly = money(form, 'weekly_price', 'Weekly price');
    for (const m of [monthly, weekly]) if ('error' in m) return { error: m.error };
    const mVal = (monthly as { value: number | null }).value;
    const wVal = (weekly as { value: number | null }).value;
    if (!mVal && !wVal) return { error: 'Set at least a monthly or a weekly price.' };
    patch.price_cents = mVal ?? 0;
    patch.weekly_price_cents = wVal || null;
    patch.active = form.get('active') === 'on';
  }

  const { error } = await sb.from('plans').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/plans');
  revalidatePath('/plans');
  return { message: 'Saved. The Plans page shows the new details now.' };
}

/** The Android app link shown on glemovies.com/app. */
export async function saveAppSettings(_: FormState, form: FormData): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only the owner can change this.' };
  const url = t(form, 'android_apk_url');
  if (url && !/^https:\/\/\S+$/i.test(url)) return { error: 'The download link must start with https://' };
  const rows = [
    { key: 'android_apk_url', value: url || null },
    { key: 'android_version', value: t(form, 'android_version').slice(0, 20) || null },
    { key: 'android_note', value: t(form, 'android_note').slice(0, 200) || null },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  const { error } = await sb.from('site_settings').upsert(rows, { onConflict: 'key' });
  if (error) return { error: error.message };
  revalidatePath('/app');
  revalidatePath('/admin/plans');
  return { message: 'Saved. glemovies.com/app now uses this link.' };
}

/** Invite-friends reward: how many friends, how many days, how many times per account. */
export async function saveReferralSettings(_: FormState, form: FormData): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only the owner can change this.' };
  const n = (k: string, min: number, max: number) => {
    const v = Number(t(form, k));
    return Number.isInteger(v) && v >= min && v <= max ? v : null;
  };
  const needed = n('referral_needed', 1, 50);
  const days = n('referral_days', 1, 365);
  const times = n('referral_max_rewards', 0, 100);
  if (needed === null || days === null || times === null) return { error: 'Use whole numbers: friends 1–50, days 1–365, times 0–100.' };
  const now = new Date().toISOString();
  const { error } = await sb.from('site_settings').upsert([
    { key: 'referral_needed', value: String(needed), updated_at: now },
    { key: 'referral_days', value: String(days), updated_at: now },
    { key: 'referral_max_rewards', value: String(times), updated_at: now },
    { key: 'referral_cap_days', value: String(Math.max(days, 90)), updated_at: now },
  ], { onConflict: 'key' });
  if (error) return { error: error.message };
  revalidatePath('/admin/plans');
  revalidatePath('/account');
  return { message: 'Saved. New sign-ups follow these rules.' };
}
