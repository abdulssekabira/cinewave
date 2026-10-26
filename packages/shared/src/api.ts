import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogTitle,
  ContinueWatchingItem,
  Entitlement,
  Genre,
  HomeRow,
  Plan,
  Profile,
  Subscription,
} from './types';

/**
 * Data access shared by web and Android. Every function takes the caller's
 * Supabase client, so the database's Row Level Security always applies.
 */

const CATALOG = 'catalog_titles';

export async function getFeatured(sb: SupabaseClient): Promise<CatalogTitle | null> {
  const { data, error } = await sb
    .from(CATALOG)
    .select('*')
    .eq('is_featured', true)
    .order('popularity', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CatalogTitle) ?? null;
}

export async function getHomeRows(sb: SupabaseClient): Promise<HomeRow[]> {
  const [trending, recent, free, collections] = await Promise.all([
    sb.from(CATALOG).select('*').order('popularity', { ascending: false }).limit(20),
    sb.from(CATALOG).select('*').order('published_at', { ascending: false }).limit(20),
    sb.from(CATALOG).select('*').eq('required_plan', 'free').order('popularity', { ascending: false }).limit(20),
    sb
      .from('collections')
      .select('slug, name, sort_order, collection_items(title_id, position)')
      .eq('active', true)
      .order('sort_order'),
  ]);
  for (const r of [trending, recent, free, collections]) if (r.error) throw r.error;

  const rows: HomeRow[] = [
    { key: 'trending', label: 'Trending Now', titles: trending.data as CatalogTitle[] },
    { key: 'recent', label: 'Recently Added', titles: recent.data as CatalogTitle[] },
    { key: 'free', label: 'Free to Watch', titles: free.data as CatalogTitle[] },
  ];

  // Curated collections: resolve their titles through the catalogue view so
  // unavailable titles are filtered out automatically.
  const byId = new Map<string, CatalogTitle>();
  for (const t of [...rows[0].titles, ...rows[1].titles]) byId.set(t.id, t);
  type CollectionRow = {
    slug: string;
    name: string;
    collection_items: { title_id: string; position: number }[];
  };
  const cols = (collections.data ?? []) as CollectionRow[];
  const missing = cols
    .flatMap((c) => c.collection_items.map((i) => i.title_id))
    .filter((id) => !byId.has(id));
  if (missing.length) {
    const { data, error } = await sb.from(CATALOG).select('*').in('id', missing);
    if (error) throw error;
    for (const t of data as CatalogTitle[]) byId.set(t.id, t);
  }
  for (const c of cols) {
    const titles = [...c.collection_items]
      .sort((a, b) => a.position - b.position)
      .map((i) => byId.get(i.title_id))
      .filter((t): t is CatalogTitle => Boolean(t));
    if (titles.length) rows.push({ key: `col-${c.slug}`, label: c.name, titles });
  }

  return rows.filter((r) => r.titles.length > 0);
}

export async function getTitleBySlug(sb: SupabaseClient, slug: string): Promise<CatalogTitle | null> {
  const { data, error } = await sb.from(CATALOG).select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as CatalogTitle) ?? null;
}

export async function getRelated(sb: SupabaseClient, title: CatalogTitle, limit = 12): Promise<CatalogTitle[]> {
  if (!title.genres.length) return [];
  const { data, error } = await sb
    .from(CATALOG)
    .select('*')
    .overlaps('genres', title.genres)
    .neq('id', title.id)
    .order('popularity', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as CatalogTitle[];
}

export interface SearchParams {
  query?: string;
  genre?: string;
  year?: number;
  access?: 'free' | 'premium';
  sort?: 'popular' | 'newest' | 'az';
}

export async function searchTitles(sb: SupabaseClient, p: SearchParams): Promise<CatalogTitle[]> {
  let q = sb.from(CATALOG).select('*');
  if (p.query?.trim()) q = q.ilike('title', `%${p.query.trim().replace(/[%_]/g, '')}%`);
  if (p.genre) q = q.contains('genres', [p.genre]);
  if (p.year) q = q.eq('release_year', p.year);
  if (p.access === 'free') q = q.eq('required_plan', 'free');
  if (p.access === 'premium') q = q.neq('required_plan', 'free');
  if (p.sort === 'newest') q = q.order('release_year', { ascending: false, nullsFirst: false });
  else if (p.sort === 'az') q = q.order('title');
  else q = q.order('popularity', { ascending: false });
  const { data, error } = await q.limit(60);
  if (error) throw error;
  return data as CatalogTitle[];
}

export async function getGenres(sb: SupabaseClient): Promise<Genre[]> {
  const { data, error } = await sb.from('genres').select('*').order('name');
  if (error) throw error;
  return data as Genre[];
}

export async function getPlans(sb: SupabaseClient): Promise<Plan[]> {
  const { data, error } = await sb.from('plans').select('*').eq('active', true).order('rank');
  if (error) throw error;
  return data as Plan[];
}

export async function getEntitlement(
  sb: SupabaseClient,
  titleId: string,
  country?: string | null,
): Promise<Entitlement> {
  const { data, error } = await sb.rpc('playback_entitlement', { t_id: titleId, country: country ?? null });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as Entitlement;
}

// ---- Signed-in user data -------------------------------------------------

export async function getProfile(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getActiveSubscription(sb: SupabaseClient): Promise<Subscription | null> {
  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .in('status', ['trialing', 'active', 'past_due'])
    .order('current_period_end', { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Subscription | null;
}

export async function getWatchlistIds(sb: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await sb.from('watchlist').select('title_id');
  if (error) throw error;
  return new Set((data ?? []).map((r: { title_id: string }) => r.title_id));
}

export async function getWatchlist(sb: SupabaseClient): Promise<CatalogTitle[]> {
  const { data, error } = await sb.from('watchlist').select('title_id, added_at').order('added_at', { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r: { title_id: string }) => r.title_id);
  if (!ids.length) return [];
  const { data: titles, error: e2 } = await sb.from(CATALOG).select('*').in('id', ids);
  if (e2) throw e2;
  const map = new Map((titles as CatalogTitle[]).map((t) => [t.id, t]));
  return ids.map((id) => map.get(id)).filter((t): t is CatalogTitle => Boolean(t));
}

export async function setWatchlisted(sb: SupabaseClient, userId: string, titleId: string, on: boolean) {
  const q = on
    ? sb.from('watchlist').upsert({ user_id: userId, title_id: titleId })
    : sb.from('watchlist').delete().eq('user_id', userId).eq('title_id', titleId);
  const { error } = await q;
  if (error) throw error;
}

export async function getContinueWatching(sb: SupabaseClient): Promise<ContinueWatchingItem[]> {
  const { data, error } = await sb
    .from('watch_progress')
    .select('title_id, position_seconds, duration_seconds')
    .eq('completed', false)
    .gt('position_seconds', 30)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as { title_id: string; position_seconds: number; duration_seconds: number | null }[];
  if (!rows.length) return [];
  const { data: titles, error: e2 } = await sb.from(CATALOG).select('*').in('id', rows.map((r) => r.title_id));
  if (e2) throw e2;
  const map = new Map((titles as CatalogTitle[]).map((t) => [t.id, t]));
  return rows
    .filter((r) => map.has(r.title_id))
    .map((r) => ({ title: map.get(r.title_id)!, position_seconds: r.position_seconds, duration_seconds: r.duration_seconds }));
}

export async function saveProgress(
  sb: SupabaseClient,
  userId: string,
  titleId: string,
  positionSeconds: number,
  durationSeconds?: number,
) {
  const completed = durationSeconds ? positionSeconds / durationSeconds > 0.92 : false;
  const { error } = await sb.from('watch_progress').upsert({
    user_id: userId,
    title_id: titleId,
    position_seconds: Math.max(0, Math.floor(positionSeconds)),
    duration_seconds: durationSeconds ? Math.floor(durationSeconds) : null,
    completed,
  });
  if (error) throw error;
}
