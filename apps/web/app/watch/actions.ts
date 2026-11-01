'use server';

import { getProfile, getTitleBySlug } from '@cinewave/shared';
import { getUser, viewerCountry } from '@/lib/supabase/server';
import { resolvePlayback } from '@/lib/playback';

/**
 * A fresh viewing link for the player when the old one stopped working
 * (expired, or the connection broke). Same checks as opening the film.
 */
export async function freshStreamUrl(slug: string, part: string | null): Promise<string | null> {
  const { sb, user } = await getUser();
  const title = await getTitleBySlug(sb, slug);
  if (!title) return null;
  const profile = user ? await getProfile(sb, user.id) : null;
  const country = await viewerCountry(profile?.country_code);
  const p = await resolvePlayback(sb, user, title, country, part);
  return p.ent.can_play ? p.src : null;
}
