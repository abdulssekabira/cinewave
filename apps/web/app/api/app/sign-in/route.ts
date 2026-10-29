import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createSb } from '@supabase/supabase-js';
import { serverSecret } from '@/lib/server-secret';

/**
 * App sign-in with a username or an email. A username is turned into the
 * account's email only here on the server, so emails never leave it.
 * The session is created with the phone's own User-Agent so it shows up
 * correctly in Account → Devices.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: string; password?: string };
  const id = String(body.identifier ?? '').trim();
  const password = String(body.password ?? '');
  const fail = (msg = 'Incorrect username/email or password.', status = 401) => NextResponse.json({ error: msg }, { status });
  if (!id || !password) return fail('Enter your username or email and your password.', 400);

  const ua = req.headers.get('user-agent') ?? 'GLE Movies app';
  const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { 'User-Agent': ua, 'X-Client-Info': 'gle-movies-app' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email = id;
  if (!id.includes('@')) {
    const s = serverSecret();
    if (!s) return fail('Sign-in with a username is not available right now. Use your email.', 503);
    const { data } = await sb.rpc('email_for_username', { s, u: id.toLowerCase() });
    if (!data) return fail();
    email = data as string;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error && /confirm/i.test(error.message)) return fail('Please confirm your email first. Check your inbox for the GLE Movies email.', 403);
    if (error && /rate/i.test(error.message)) return fail('Too many attempts. Wait a few minutes and try again.', 429);
    return fail();
  }
  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
