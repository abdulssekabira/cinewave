import { Platform } from 'react-native';
import { supabase } from './supabase';

/** The GLE Movies website, which issues stream links and handles username sign-in. */
export const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://www.glemovies.com').replace(/\/$/, '');

const UA = `GLE Movies app on ${Platform.OS === 'android' ? 'Android' : Platform.OS} (okhttp)`;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type PlayInfo = {
  title: { id: string; slug: string; title: string; kind: 'movie' | 'series' };
  can_play: boolean;
  reason: string;
  required_plan: string | null;
  src: string | null;
  start_at: number;
  start_at_updated: string | null;
  episode: {
    id: string;
    label: string;
    name: string | null;
    next: { id: string; label: string; name: string | null } | null;
  } | null;
};

/** Asks the website whether this viewer may play, and for a short-lived stream link. */
export async function getPlayInfo(slug: string, part?: string | null): Promise<PlayInfo> {
  const q = new URLSearchParams({ slug });
  if (part) q.set('part', part);
  const res = await fetch(`${SITE}/api/app/play?${q}`, { headers: { ...(await authHeaders()), 'User-Agent': UA } });
  if (!res.ok) throw new Error(res.status === 404 ? 'This title is not available.' : 'Could not reach GLE Movies. Check your connection.');
  return res.json();
}

/** Signs in with a username or an email. */
export async function signInWithIdentifier(identifier: string, password: string): Promise<string | null> {
  const id = identifier.trim();
  if (id.includes('@')) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    if (!error) return null;
    if (/confirm/i.test(error.message)) return 'Please confirm your email first. Check your inbox for the GLE Movies email.';
    return 'Incorrect username/email or password.';
  }
  try {
    const res = await fetch(`${SITE}/api/app/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ identifier: id, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; access_token?: string; refresh_token?: string };
    if (!res.ok || !body.access_token || !body.refresh_token) return body.error ?? 'Incorrect username/email or password.';
    const { error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token });
    return error ? 'Could not sign in. Try again.' : null;
  } catch {
    return 'Could not reach GLE Movies. Check your connection.';
  }
}
