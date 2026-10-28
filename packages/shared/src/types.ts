export type PlanId = 'free' | 'standard' | 'premium';

export interface Credit {
  name: string;
  role: string;
}

/** A row from the public `catalog_titles` view. */
export interface CatalogTitle {
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
  is_featured: boolean;
  popularity: number;
  published_at: string | null;
  genres: string[];
  downloadable: boolean;
  rating: number | null;
  rating_source: string | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  rank: number;
  price_cents: number;
  weekly_price_cents: number | null;
  annual_price_cents: number | null;
  currency: string;
  shows_ads: boolean;
  max_quality: string;
  downloads_allowed: boolean;
  max_streams: number;
  description?: string | null;
  features?: string[];
  active?: boolean;
}

export interface Genre {
  id: number;
  slug: string;
  name: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  country_code: string | null;
  preferred_language: string | null;
}

export interface Subscription {
  id: string;
  plan_id: PlanId;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'refunded';
  provider: 'stripe' | 'google_play' | 'manual' | 'pesapal';
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export type EntitlementReason =
  | 'ok'
  | 'not_found'
  | 'not_available_in_region'
  | 'sign_in_required'
  | 'upgrade_required';

export interface Entitlement {
  can_play: boolean;
  can_download: boolean;
  reason: EntitlementReason;
  user_plan: PlanId;
  required_plan: PlanId | null;
}

export interface ContinueWatchingItem {
  title: CatalogTitle;
  position_seconds: number;
  duration_seconds: number | null;
}

export interface HomeRow {
  key: string;
  label: string;
  titles: CatalogTitle[];
}
