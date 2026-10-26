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

export function formatPrice(cents: number, currency = 'USD'): string {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
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
