import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CatalogTitle,
  ContinueWatchingItem,
  Entitlement,
  Episode,
  Genre,
  HomeRow,
  Plan,
  Profile,
  Subscription,
  Vj,
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

/** Titles for the hero carousel: featured first, topped up with popular titles. */
/**
 * Newest uploads first: films by when they became watchable, series by their
 * newest episode (or when they were added, whichever is later).
 */
export async function getLatestTitles(sb: SupabaseClient, limit = 20): Promise<CatalogTitle[]> {
  const [byAdded, byEpisode] = await Promise.all([
    sb.from(CATALOG).select('*').order('added_at', { ascending: false, nullsFirst: false }).limit(limit),
    sb.from(CATALOG).select('*').eq('kind', 'series').not('latest_episode_at', 'is', null)
      .order('latest_episode_at', { ascending: false }).limit(Math.min(limit, 10)),
  ]);
  if (byAdded.error) throw byAdded.error;
  const seen = new Map<string, CatalogTitle>();
  for (const t of [...(byAdded.data ?? []), ...(byEpisode.data ?? [])] as CatalogTitle[]) seen.set(t.id, t);
  const at = (t: CatalogTitle) => Math.max(Date.parse(t.added_at ?? t.published_at ?? '') || 0, Date.parse(t.latest_episode_at ?? '') || 0);
  return [...seen.values()].sort((a, b) => at(b) - at(a)).slice(0, limit);
}

/** The big banner on the home page: the newest uploads. */
export async function getHeroTitles(sb: SupabaseClient, limit = 6): Promise<CatalogTitle[]> {
  return getLatestTitles(sb, limit);
}

export async function getHomeRows(sb: SupabaseClient): Promise<HomeRow[]> {
  const [trending, latest, free, collections] = await Promise.all([
    sb.from(CATALOG).select('*').order('popularity', { ascending: false }).limit(20),
    getLatestTitles(sb, 20).then((data) => ({ data, error: null })),
    sb.from(CATALOG).select('*').eq('required_plan', 'free').order('popularity', { ascending: false }).limit(20),
    sb
      .from('collections')
      .select('slug, name, sort_order, collection_items(title_id, position)')
      .eq('active', true)
      .order('sort_order'),
  ]);
  for (const r of [trending, free, collections]) if (r.error) throw r.error;

  const rows: HomeRow[] = [
    { key: 'recent', label: 'Just Added', titles: latest.data },
    { key: 'trending', label: 'Trending This Week', titles: trending.data as CatalogTitle[] },
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
  // Suggestions: same genres first, then the same VJ, then the latest films.
  const out: CatalogTitle[] = [];
  const seen = new Set<string>([title.id]);
  const add = (rows: CatalogTitle[] | null) => {
    for (const r of rows ?? []) if (!seen.has(r.id) && out.length < limit) { seen.add(r.id); out.push(r); }
  };
  if (title.genres.length) {
    const { data } = await sb.from(CATALOG).select('*').overlaps('genres', title.genres).neq('id', title.id)
      .order('popularity', { ascending: false }).limit(limit);
    add(data as CatalogTitle[] | null);
  }
  if (out.length < limit && title.vj_slug) {
    const { data } = await sb.from(CATALOG).select('*').eq('vj_slug', title.vj_slug).neq('id', title.id)
      .order('published_at', { ascending: false, nullsFirst: false }).limit(limit);
    add(data as CatalogTitle[] | null);
  }
  if (out.length < limit) {
    const { data } = await sb.from(CATALOG).select('*').neq('id', title.id)
      .order('published_at', { ascending: false, nullsFirst: false }).limit(limit + 1);
    add(data as CatalogTitle[] | null);
  }
  return out;
}

export interface SearchParams {
  query?: string;
  genre?: string;
  vj?: string;
  kind?: 'movie' | 'series';
  year?: number;
  access?: 'free' | 'premium';
  /** Default: latest added first. 'newest' = newest release year. */
  sort?: 'latest' | 'popular' | 'newest' | 'az';
}

export async function searchTitles(sb: SupabaseClient, p: SearchParams): Promise<CatalogTitle[]> {
  let q = sb.from(CATALOG).select('*');
  if (p.query?.trim()) q = q.ilike('title', `%${p.query.trim().replace(/[%_]/g, '')}%`);
  if (p.genre) q = q.contains('genres', [p.genre]);
  if (p.vj) q = q.eq('vj_slug', p.vj);
  if (p.kind) q = q.eq('kind', p.kind);
  if (p.year) q = q.eq('release_year', p.year);
  if (p.access === 'free') q = q.eq('required_plan', 'free');
  if (p.access === 'premium') q = q.neq('required_plan', 'free');
  if (p.sort === 'newest') q = q.order('release_year', { ascending: false, nullsFirst: false });
  else if (p.sort === 'az') q = q.order('title');
  else if (p.sort === 'popular') q = q.order('popularity', { ascending: false });
  else q = q.order('published_at', { ascending: false, nullsFirst: false }).order('title');
  const { data, error } = await q.limit(60);
  if (error) throw error;
  return data as CatalogTitle[];
}

/** Genres viewers can pick from (hidden ones left out), in the owner's order. */
export async function getGenres(sb: SupabaseClient, includeHidden = false): Promise<Genre[]> {
  let q = sb.from('genres').select('*').order('sort_order').order('name');
  if (!includeHidden) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Genre[];
}

/** VJs viewers can pick from, in the owner's order. */
export async function getVjs(sb: SupabaseClient, includeHidden = false): Promise<Vj[]> {
  let q = sb.from('vjs').select('*').order('sort_order').order('name');
  if (!includeHidden) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Vj[];
}

/** How many viewable films each genre and VJ has (for the filter lists). */
export async function getFilterCounts(sb: SupabaseClient) {
  const { data } = await sb.from(CATALOG).select('genres, vj_slug, release_year').limit(5000);
  const genres: Record<string, number> = {};
  const vjs: Record<string, number> = {};
  const years: Record<string, number> = {};
  for (const r of (data ?? []) as { genres: string[]; vj_slug: string | null; release_year: number | null }[]) {
    for (const g of r.genres ?? []) genres[g] = (genres[g] ?? 0) + 1;
    if (r.vj_slug) vjs[r.vj_slug] = (vjs[r.vj_slug] ?? 0) + 1;
    if (r.release_year) years[String(r.release_year)] = (years[String(r.release_year)] ?? 0) + 1;
  }
  return { genres, vjs, years, total: data?.length ?? 0 };
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
    .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
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
    .select('title_id, position_seconds, duration_seconds, episode:episodes(id, season, number, name)')
    .eq('completed', false)
    .or('position_seconds.gt.30,episode_id.not.is.null')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    title_id: string; position_seconds: number; duration_seconds: number | null;
    episode: Pick<Episode, 'id' | 'season' | 'number' | 'name'> | null;
  }[];
  if (!rows.length) return [];
  const { data: titles, error: e2 } = await sb.from(CATALOG).select('*').in('id', rows.map((r) => r.title_id));
  if (e2) throw e2;
  const map = new Map((titles as CatalogTitle[]).map((t) => [t.id, t]));
  return rows
    .filter((r) => map.has(r.title_id))
    .map((r) => ({
      title: map.get(r.title_id)!,
      position_seconds: r.position_seconds,
      duration_seconds: r.duration_seconds,
      episode: r.episode,
    }));
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

// ---- Series ---------------------------------------------------------------

/** Parts of a series in viewing order (season, then part number). */
export async function getEpisodes(sb: SupabaseClient, titleId: string): Promise<Episode[]> {
  const { data, error } = await sb
    .from('episodes')
    .select('*')
    .eq('title_id', titleId)
    .order('season')
    .order('number');
  if (error) throw error;
  return data as Episode[];
}

/** Resume points for each part of a series (signed-in viewer). */
export async function getEpisodeProgress(sb: SupabaseClient, episodeIds: string[]) {
  if (!episodeIds.length) return new Map<string, { position_seconds: number; duration_seconds: number | null; completed: boolean; updated_at: string }>();
  const { data } = await sb
    .from('episode_progress')
    .select('episode_id, position_seconds, duration_seconds, completed, updated_at')
    .in('episode_id', episodeIds);
  return new Map((data ?? []).map((r) => [r.episode_id as string, r]));
}

/**
 * Saves where the viewer is in a part, and remembers on the series which
 * part they're on. Finishing a part moves the series on to the next one.
 */
export async function saveEpisodeProgress(
  sb: SupabaseClient,
  userId: string,
  titleId: string,
  episodeId: string,
  positionSeconds: number,
  durationSeconds?: number,
) {
  const pos = Math.max(0, Math.floor(positionSeconds));
  const dur = durationSeconds ? Math.floor(durationSeconds) : null;
  const completed = dur ? pos / dur > 0.92 : false;
  const { error } = await sb.from('episode_progress').upsert({
    user_id: userId, episode_id: episodeId, position_seconds: pos, duration_seconds: dur, completed,
  });
  if (error) throw error;

  let seriesEpisode: string | null = episodeId;
  let seriesPos = pos;
  let seriesDone = false;
  if (completed) {
    const eps = await getEpisodes(sb, titleId);
    const i = eps.findIndex((e) => e.id === episodeId);
    const next = i >= 0 ? eps.slice(i + 1).find((e) => e.published) : undefined;
    if (next) { seriesEpisode = next.id; seriesPos = 0; } else { seriesDone = true; }
  }
  await sb.from('watch_progress').upsert({
    user_id: userId, title_id: titleId, episode_id: seriesEpisode,
    position_seconds: seriesPos, duration_seconds: seriesPos ? dur : null, completed: seriesDone,
  });
}

// ------------------------------------------------------------ notifications

export interface AppNotification {
  id: string;
  kind: string;
  title_id: string | null;
  episode_id: string | null;
  heading: string;
  body: string | null;
  link: string | null;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
  popup_shown_at: string | null;
}

export async function getNotifications(sb: SupabaseClient, limit = 30): Promise<AppNotification[]> {
  const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(sb: SupabaseClient): Promise<number> {
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  return count ?? 0;
}

/** New notifications not yet shown as a pop-up (last 14 days). */
export async function getPopupNotifications(sb: SupabaseClient): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await sb.from('notifications').select('*').is('popup_shown_at', null).gte('created_at', since)
    .order('created_at', { ascending: false }).limit(5);
  return (data ?? []) as AppNotification[];
}

export async function markNotifications(sb: SupabaseClient, opts: { ids?: string[]; read?: boolean; popup?: boolean } = {}) {
  await sb.rpc('mark_notifications', { ids: opts.ids ?? null, read: opts.read ?? true, popup: opts.popup ?? false });
}

// ------------------------------------------------------------ adverts

export interface Ad {
  id: string;
  name: string;
  image_url: string | null;
  headline: string;
  subtext: string | null;
  link_url: string | null;
  cta: string;
  weight: number;
}

export interface AdPlan {
  ads: Ad[];
  firstAfterSec: number;
  everySec: number;
  showSec: number;
}

/**
 * Adverts for this viewer on this title, or null when they shouldn't see any
 * (paid plan, rights don't allow ads, or no adverts running).
 */
export async function getAdPlan(sb: SupabaseClient, titleId: string, country: string | null): Promise<AdPlan | null> {
  const { data: show } = await sb.rpc('shows_ads_for', { t_id: titleId, country });
  if (!show) return null;
  const [{ data: ads }, { data: settings }] = await Promise.all([
    sb.from('ads').select('id, name, image_url, headline, subtext, link_url, cta, weight')
      .eq('active', true).lte('starts_at', new Date().toISOString())
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).limit(50),
    sb.from('site_settings').select('key, value').in('key', ['ad_first_after_min', 'ad_every_min', 'ad_show_sec']),
  ]);
  if (!ads?.length) return null;
  const num = (k: string, d: number) => {
    const v = Number(settings?.find((r) => r.key === k)?.value);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    ads: ads as Ad[],
    firstAfterSec: Math.round(num('ad_first_after_min', 2) * 60),
    everySec: Math.round(num('ad_every_min', 10) * 60),
    showSec: Math.round(num('ad_show_sec', 12)),
  };
}

/** Picks an advert, favouring higher weights. */
export function pickAd(ads: Ad[], avoidId?: string): Ad | null {
  const pool = ads.length > 1 && avoidId ? ads.filter((a) => a.id !== avoidId) : ads;
  const total = pool.reduce((n, a) => n + (a.weight || 1), 0);
  let r = Math.random() * total;
  for (const a of pool) { r -= a.weight || 1; if (r <= 0) return a; }
  return pool[0] ?? null;
}

export async function logAdEvent(sb: SupabaseClient, adId: string, kind: 'view' | 'click', titleId?: string) {
  await sb.rpc('log_ad_event', { a_id: adId, k: kind, t_id: titleId ?? null });
}

// ------------------------------------------------------------------ reviews

export interface ReviewSummary {
  average: number | null;
  total: number;
  counts: [number, number, number, number, number]; // 1★ … 5★
  canReview: boolean;
  myStars: number | null;
}
export interface Review {
  id: string;
  stars: number;
  body: string | null;
  author: string;
  created_at: string;
  updated_at: string;
  mine: boolean;
}

export async function getReviewSummary(sb: SupabaseClient, titleId: string): Promise<ReviewSummary> {
  const { data, error } = await sb.rpc('review_summary', { t_id: titleId });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number | boolean | null> | undefined;
  return {
    average: r?.average != null ? Number(r.average) : null,
    total: Number(r?.total ?? 0),
    counts: [1, 2, 3, 4, 5].map((n) => Number(r?.[`s${n}`] ?? 0)) as ReviewSummary['counts'],
    canReview: Boolean(r?.can_review),
    myStars: r?.my_stars != null ? Number(r.my_stars) : null,
  };
}

export async function getReviews(sb: SupabaseClient, titleId: string, offset = 0, limit = 10): Promise<Review[]> {
  const { data, error } = await sb.rpc('title_reviews', { t_id: titleId, lim: limit, off: offset });
  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Returns an error message, or null when saved. */
export async function saveReview(sb: SupabaseClient, titleId: string, stars: number, body: string): Promise<string | null> {
  const { data, error } = await sb.rpc('save_review', { t_id: titleId, n_stars: stars, n_body: body });
  if (error) return 'Couldn’t save your review. Check your connection and try again.';
  return (data as string | null) ?? null;
}

export async function deleteMyReview(sb: SupabaseClient, titleId: string) {
  const { error } = await sb.rpc('delete_my_review', { t_id: titleId });
  if (error) throw error;
}

export async function reportReview(sb: SupabaseClient, reviewId: string) {
  const { error } = await sb.rpc('report_review', { r_id: reviewId });
  if (error) throw error;
}

/** "3 days ago" style date for reviews. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60, h = m / 60, d = h / 24;
  if (m < 60) return `${Math.floor(m)} min ago`;
  if (h < 24) return `${Math.floor(h)} h ago`;
  if (d < 30) return `${Math.floor(d)} day${Math.floor(d) === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ------------------------------------------------------------------ timed comments

export interface TimedComment {
  id: string;
  at_seconds: number;
  body: string;
  author: string;
  created_at: string;
  mine: boolean;
  replies: number;
}
export interface TimedReply { id: string; body: string; author: string; created_at: string; mine: boolean }

/** Tell the server how far we are (every ~10 s while playing). Returns the honest "reached" mark. */
export async function trackWatch(sb: SupabaseClient, titleId: string, episodeId: string | null, pos: number): Promise<number | null> {
  const { data, error } = await sb.rpc('track_watch', { t_id: titleId, e_id: episodeId, pos: Math.floor(pos) });
  if (error) return null;
  return Number(data ?? 0);
}

export async function getMyReach(sb: SupabaseClient, titleId: string, episodeId: string | null): Promise<number> {
  const { data } = await sb.rpc('my_reach', { t_id: titleId, e_id: episodeId });
  return Number(data ?? 0);
}

export async function getTimedComments(sb: SupabaseClient, titleId: string, episodeId: string | null, from: number, to: number): Promise<TimedComment[]> {
  const { data, error } = await sb.rpc('timed_comments_between', { t_id: titleId, e_id: episodeId, from_s: Math.floor(from), to_s: Math.ceil(to) });
  if (error) throw error;
  return (data ?? []) as TimedComment[];
}

export async function getTimedReplies(sb: SupabaseClient, commentId: string): Promise<TimedReply[]> {
  const { data, error } = await sb.rpc('timed_comment_replies', { c_id: commentId });
  if (error) throw error;
  return (data ?? []) as TimedReply[];
}

/** Error text, or null when posted. Pass parentId to reply (the time comes from the comment). */
export async function postTimedComment(sb: SupabaseClient, titleId: string, episodeId: string | null, at: number, body: string, parentId?: string | null): Promise<string | null> {
  const { data, error } = await sb.rpc('post_timed_comment', { t_id: titleId, e_id: episodeId, at: Math.floor(at), txt: body, parent: parentId ?? null });
  if (error) return 'Couldn’t post. Check your connection and try again.';
  return (data as string | null) ?? null;
}

export async function deleteMyTimedComment(sb: SupabaseClient, id: string) {
  await sb.rpc('delete_my_timed_comment', { c_id: id });
}

export async function reportTimedComment(sb: SupabaseClient, id: string) {
  await sb.rpc('report_timed_comment', { c_id: id });
}

/** 0:47 / 1:02:05 */
export function clockLabel(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
