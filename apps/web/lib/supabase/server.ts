import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

/** Supabase client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: the proxy refreshes sessions instead.
          }
        },
      },
    },
  );
}

/** The signed-in user, verified with Supabase Auth (not just read from the cookie). */
export async function getUser() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

/**
 * Viewer's country for territory rights: their profile setting first, then
 * the hosting platform's geo header (Vercel / Cloudflare), else unknown.
 */
export async function viewerCountry(profileCountry?: string | null): Promise<string | null> {
  if (profileCountry) return profileCountry;
  const h = await headers();
  return h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry') ?? null;
}
