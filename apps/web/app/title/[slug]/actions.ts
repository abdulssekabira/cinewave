'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setWatchlisted } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

export async function toggleWatchlist(titleId: string, slug: string, on: boolean) {
  const { sb, user } = await getUser();
  if (!user) redirect(`/login?next=/title/${slug}`);
  await setWatchlisted(sb, user.id, titleId, on);
  revalidatePath(`/title/${slug}`);
  revalidatePath('/watchlist');
}
