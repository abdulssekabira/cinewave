'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

/** Give a user a free plan for N days (testers, partners, competition winners). */
export async function grantComplimentary(userId: string, form: FormData) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  const plan = String(form.get('plan'));
  const days = Number(form.get('days'));
  if (!['standard', 'premium'].includes(plan) || ![7, 30, 90, 365].includes(days)) return;
  await sb.from('subscriptions').insert({
    user_id: userId,
    plan_id: plan,
    status: 'active',
    provider: 'manual',
    provider_ref: `comp-${userId}-${Date.now()}`,
    current_period_end: new Date(Date.now() + days * 864e5).toISOString(),
  });
  revalidatePath('/admin/users');
}

export async function endComplimentary(subscriptionId: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb
    .from('subscriptions')
    .update({ status: 'canceled', current_period_end: new Date().toISOString() })
    .eq('id', subscriptionId)
    .eq('provider', 'manual');
  revalidatePath('/admin/users');
}
