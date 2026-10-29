'use server';

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';

export type ProfileState = { error?: string; message?: string };

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const { sb, user } = await getUser();
  if (!user) return { error: 'Please sign in again.' };
  const username = String(form.get('username') ?? '').trim().toLowerCase();
  if (username && !/^[a-z0-9_.]{3,20}$/.test(username)) {
    return { error: 'Usernames are 3–20 characters: letters, numbers, dots or underscores (no spaces).' };
  }
  const country = String(form.get('country') ?? '').trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: 'Use a 2-letter country code, e.g. UG or KE.' };

  const { error } = await sb
    .from('profiles')
    .update({
      display_name: String(form.get('display_name') ?? '').trim().slice(0, 60) || null,
      country_code: country || null,
      ...(username ? { username } : {}),
    })
    .eq('id', user.id);
  if (error) {
    if (error.code === '23505') return { error: `The username “${username}” is taken. Try another one.` };
    return { error: error.message };
  }
  revalidatePath('/account');
  return { message: 'Saved.' };
}

export async function requestDeletion(): Promise<ProfileState> {
  const { sb, user } = await getUser();
  if (!user) return { error: 'Please sign in again.' };
  const { error } = await sb
    .from('profiles')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/account');
  return { message: 'Deletion requested. We’ll confirm by email.' };
}

/** Signs another device out of this account (frees a device slot). */
export async function removeDevice(sessionId: string) {
  const { sb, user } = await getUser();
  if (!user) return;
  await sb.rpc('remove_device', { p_session: sessionId });
  revalidatePath('/account');
}
