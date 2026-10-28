'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get('email') ?? '').trim(),
    password: String(form.get('password') ?? ''),
  });
  if (error) return { error: 'Incorrect email or password.' };
  revalidatePath('/', 'layout');
  redirect(safeNext(form.get('next')));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters for your password.' };

  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      data: { display_name: String(form.get('name') ?? '').trim() || undefined },
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
  await sb.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
