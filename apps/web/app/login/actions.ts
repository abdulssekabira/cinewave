'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/confirm`,
      data: { display_name: String(form.get('name') ?? '').trim() || undefined },
    },
  });
  if (error) return { error: error.message };
  if (!data.session) return { message: 'Check your email to confirm your account, then sign in.' };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const sb = await createClient();
  await sb.auth.resetPasswordForEmail(String(form.get('email') ?? '').trim(), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/confirm?next=/account/password`,
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
