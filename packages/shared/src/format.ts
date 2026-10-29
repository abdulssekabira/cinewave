import type { CatalogTitle, EntitlementReason, PlanId } from './types';

export const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Free',
  standard: 'Standard',
  premium: 'Premium',
};

export function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Formats a price stored in the currency's smallest unit.
 * UGX has no minor unit, so formatPrice(15000, 'UGX') → "UGX 15,000".
 */
export function formatPrice(amount: number, currency = 'UGX'): string {
  if (amount === 0) return 'Free';
  const nf = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'code' });
  const digits = nf.resolvedOptions().maximumFractionDigits ?? 2;
  return nf.format(amount / 10 ** digits).replace(/\u00a0/g, ' ');
}

export function genreLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

export function metaLine(t: CatalogTitle): string {
  return [t.release_year, formatRuntime(t.runtime_minutes), t.maturity_rating].filter(Boolean).join(' · ');
}

/** What to tell the viewer when they can't play a title. */
export function entitlementMessage(reason: EntitlementReason, required: PlanId | null): string {
  switch (reason) {
    case 'ok':
      return '';
    case 'sign_in_required':
      return `Sign in and subscribe to ${PLAN_LABEL[required ?? 'standard']} to watch.`;
    case 'upgrade_required':
      return `Available on the ${PLAN_LABEL[required ?? 'standard']} plan.`;
    case 'device_limit':
      return 'Your account is already in use on the maximum number of devices. Remove one in Account → Devices to watch here.';
    case 'not_available_in_region':
      return 'Not available in your region.';
    case 'not_found':
    default:
      return 'This title is not currently available.';
  }
}

export function progressPercent(position: number, duration: number | null, runtimeMinutes: number | null) {
  const total = duration ?? (runtimeMinutes ? runtimeMinutes * 60 : null);
  if (!total) return 0;
  return Math.min(100, Math.round((position / total) * 100));
}

/** "8.2" for display next to a star, or null when there is no rating. */
export function ratingLabel(rating: number | null | undefined): string | null {
  return rating == null ? null : Number(rating).toFixed(1);
}

/**
 * Turns a stored image path into a full URL. Paths starting with "/" are
 * files served by the website (sample artwork); full URLs pass through.
 */
export function imageUrl(path: string | null | undefined, siteBase?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (!siteBase) return path;
  return siteBase.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}
