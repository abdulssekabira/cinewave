import { createClient } from '@/lib/supabase/server';

export const COMPANY = 'Gamers Loft Entertainment';
export const BRAND = 'GLE Movies';
export const ADDRESS = 'Munyonyo, Kampala, Uganda';
export const LEGAL_UPDATED = '7 November 2026';

export type Contact = { email: string | null; phone: string | null; whatsapp: string | null };

/** Business contact details the owner sets in Admin → Plans → Contact details. */
export async function getContact(): Promise<Contact> {
  const sb = await createClient();
  const { data } = await sb.from('site_settings').select('key, value').in('key', ['contact_email', 'contact_phone', 'contact_whatsapp']);
  const get = (k: string) => data?.find((r) => r.key === k)?.value?.trim() || null;
  return { email: get('contact_email'), phone: get('contact_phone'), whatsapp: get('contact_whatsapp') };
}
