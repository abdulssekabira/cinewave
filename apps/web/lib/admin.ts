import { notFound, redirect } from 'next/navigation';
import type { Credit, PlanId } from '@cinewave/shared';
import { getUser } from '@/lib/supabase/server';

export type TitleStatus = 'draft' | 'published' | 'archived';

/** A full row from public.titles (staff can read every status). */
export interface AdminTitle {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  synopsis: string | null;
  release_year: number | null;
  runtime_minutes: number | null;
  maturity_rating: string | null;
  content_warnings: string[];
  original_language: string | null;
  audio_languages: string[];
  subtitle_languages: string[];
  credits: Credit[];
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  required_plan: PlanId;
  status: TitleStatus;
  is_featured: boolean;
  popularity: number;
  rating: number | null;
  rating_source: string | null;
  vj_id: number | null;
  kind: 'movie' | 'series';
  published_at: string | null;
  updated_at: string;
}

export interface RightsRow {
  id: string;
  title_id: string;
  partner_id: string | null;
  contract_ref: string;
  territories: string[];
  starts_at: string;
  ends_at: string | null;
  allow_stream: boolean;
  allow_download: boolean;
  allow_ads: boolean;
  download_expiry_hours: number | null;
  notes: string | null;
}

export interface Partner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
}

/**
 * Signed-in staff only. Signed-out visitors go to login; signed-in users
 * without a role get a 404 so the admin area isn't advertised.
 */
export async function requireStaff() {
  const { sb, user } = await getUser();
  if (!user) redirect('/login?next=/admin');
  const [{ data: staff }, { data: admin }] = await Promise.all([
    sb.rpc('is_staff'),
    sb.rpc('has_role', { r: 'admin' }),
  ]);
  if (!staff) notFound();
  return { sb, user, isAdmin: Boolean(admin) };
}

export const TZ = 'Africa/Kampala';

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

/** A date input value (YYYY-MM-DD) as the start of that day in Kampala. */
export function kampalaDay(d: string) {
  return `${d}T00:00:00+03:00`;
}

/** Today's date in Kampala as YYYY-MM-DD. */
export function todayKampala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function rightsActive(r: RightsRow, now = Date.now()) {
  return r.allow_stream && Date.parse(r.starts_at) <= now && (!r.ends_at || Date.parse(r.ends_at) > now);
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Viewer-facing status of a title, from its status and rights. */
export function availability(t: Pick<AdminTitle, 'status'>, rights: RightsRow[]) {
  if (t.status === 'archived') return { label: 'Archived', tone: 'muted' as const };
  if (t.status === 'draft') return { label: 'Draft', tone: 'muted' as const };
  const live = rights.filter((r) => rightsActive(r));
  if (!live.length) return { label: 'Hidden — no active rights', tone: 'warn' as const };
  const worldwide = live.some((r) => r.territories.includes('*'));
  return { label: worldwide ? 'Live · Worldwide' : `Live · ${[...new Set(live.flatMap((r) => r.territories))].join(', ')}`, tone: 'ok' as const };
}
