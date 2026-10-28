'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export type FormState = { error?: string; message?: string };

export async function addPartner(_: FormState, form: FormData): Promise<FormState> {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return { error: 'Only administrators can add partners.' };
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Enter the partner’s name.' };
  const email = String(form.get('contact_email') ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address doesn’t look right.' };

  const { error } = await sb.from('partners').insert({
    name,
    contact_name: String(form.get('contact_name') ?? '').trim() || null,
    contact_email: email || null,
    notes: String(form.get('notes') ?? '').trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/admin/partners');
  return { message: `${name} added.` };
}
