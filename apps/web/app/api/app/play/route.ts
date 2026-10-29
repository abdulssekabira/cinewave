import { NextResponse, type NextRequest } from 'next/server';
import { getProfile, getTitleBySlug } from '@cinewave/shared';
import { bearerClient, requestCountry } from '@/lib/supabase/bearer';
import { resolvePlayback } from '@/lib/playback';

/**
 * For the Android app: may this viewer play this title (or series part),
 * and if so a short-lived signed stream URL and the resume point.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const part = req.nextUrl.searchParams.get('part');
  const { sb, user } = await bearerClient(req);
  const title = slug ? await getTitleBySlug(sb, slug) : null;
  if (!title) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const profile = user ? await getProfile(sb, user.id) : null;
  const p = await resolvePlayback(sb, user, title, profile?.country_code ?? requestCountry(req), part);
  return NextResponse.json(
    {
      title: { id: title.id, slug: title.slug, title: title.title, kind: title.kind ?? 'movie' },
      can_play: p.ent.can_play && !p.noParts,
      reason: p.noParts ? 'no_parts' : p.ent.reason,
      required_plan: p.ent.required_plan,
      src: p.src,
      start_at: p.startAt,
      start_at_updated: p.startAtUpdated,
      episode: p.episode,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
