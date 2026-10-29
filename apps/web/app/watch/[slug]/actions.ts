'use server';

import { saveEpisodeProgress, saveProgress } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

/** Called by the player every few seconds while playing, and on pause/exit. */
export async function saveWatchProgress(titleId: string, position: number, duration?: number, episodeId?: string) {
  const { sb, user } = await getUser();
  if (!user) return;
  if (episodeId) await saveEpisodeProgress(sb, user.id, titleId, episodeId, position, duration);
  else await saveProgress(sb, user.id, titleId, position, duration);
}
