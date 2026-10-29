import { createClient as createSb } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

/**
 * Supabase client for the Android app's API calls. The app sends its own
 * access token; database rules then apply exactly as for that viewer.
 */
export async function bearerClient(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = token ? (await sb.auth.getUser(token)).data.user : null;
  return { sb, user };
}

export function requestCountry(req: NextRequest) {
  return req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? null;
}
