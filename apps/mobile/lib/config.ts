/**
 * Public settings. Values come from eas.json at build time; the fallbacks
 * keep over-the-air updates working too (they're bundled without eas.json).
 * These are PUBLIC values (the publishable key is safe to ship in apps).
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://bugmkghovzdgncspjvwy.supabase.co';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_KBXLxTuRc-PR0aPrVjo4mw_vmLvoXrU';
export const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://www.glemovies.com').replace(/\/$/, '');
