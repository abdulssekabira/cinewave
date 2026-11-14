'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export async function setReviewHidden(id: string, hidden: boolean) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('reviews').update(hidden ? { hidden: true } : { hidden: false, reports: 0 }).eq('id', id);
  if (!hidden) await sb.from('review_reports').delete().eq('review_id', id);
  revalidatePath('/admin/reviews');
}

export async function deleteReview(id: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('reviews').delete().eq('id', id);
  revalidatePath('/admin/reviews');
}
