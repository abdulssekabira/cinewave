'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { serverSecret } from '@/lib/server-secret';

const USERNAME = /^[a-z0-9_.]{3,20}$/;

/** The address this site is being viewed on (works on localhost, Vercel and a custom domain). */
async function siteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export type AuthState = { error?: string; message?: string };

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === 'string' ? next : '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const sb = await createClient();
  const id = String(form.get('email') ?? '').trim();
  let email = id;
  if (!id.includes('@')) {
    // Signing in with a username: look up the email on the server only.
    const s = serverSecret();
    const { data } = s ? await sb.rpc('email_for_username', { s, u: id.toLowerCase() }) : { data: null };
    if (!data) return { error: 'Incorrect username/email or password.' };
    email = data as string;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password: String(form.get('password') ?? '') });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: 'Please confirm your email first. Check your inbox for the GLE Movies email.' };
    return { error: 'Incorrect username/email or password.' };
  }
  revalidatePath('/', 'layout');
  redirect(safeNext(form.get('next')));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const username = String(form.get('username') ?? '').trim().toLowerCase();
  if (!USERNAME.test(username)) return { error: 'Usernames are 3–20 characters: letters, numbers, dots or underscores (no spaces).' };
  if (password.length < 8) return { error: 'Use at least 8 characters for your password.' };

  const sb = await createClient();
  const { data: free } = await sb.rpc('username_available', { u: username });
  if (!free) return { error: `The username “${username}” is taken. Try another one.` };
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      data: { display_name: String(form.get('name') ?? '').trim() || undefined, username },
    },
  });
  if (error) {
    if (/rate limit/i.test(error.message)) return { error: 'Too many sign-up emails were sent in the last hour. Please try again in an hour.' };
    return { error: error.message };
  }
  if (!data.session) return { message: 'Check your email to confirm your account, then sign in.' };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(String(form.get('email') ?? '').trim(), {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/account/password`,
  });
  // Same message either way, so the form can't be used to discover accounts.
  return { message: 'If that email has an account, a reset link is on its way.' };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { message: 'Password updated.' };
}

export async function signOut() {
  const sb = await createClient();
  // Only this device; other devices stay signed in.
  await sb.auth.signOut({ scope: 'local' });
  revalidatePath('/', 'layout');
  redirect('/');
}
