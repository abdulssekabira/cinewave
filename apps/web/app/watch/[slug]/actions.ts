'use server';

import { saveProgress } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

/** Called by the player every ~10s while playing, and on pause/exit. */
export async function saveWatchProgress(titleId: string, position: number, duration?: number) {
  const { sb, user } = await getUser();
  if (!user) return;
  await saveProgress(sb, user.id, titleId, position, duration);
}
