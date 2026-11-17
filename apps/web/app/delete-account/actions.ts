'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type DeleteState = { error?: string };

export async function deleteAccount(_: DeleteState, form: FormData): Promise<DeleteState> {
  if (String(form.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE in the box to confirm.' };
  const sb = await createClient();
  const { data, error } = await sb.rpc('delete_my_account');
  if (error) return { error: 'Couldn’t delete your account. Check your connection and try again.' };
  if (data) return { error: data as string };
  await sb.auth.signOut().catch(() => {});
  redirect('/delete-account?done=1');
}
