'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/admin';

export async function setCommentHidden(id: string, hidden: boolean) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('timed_comments').update(hidden ? { hidden: true } : { hidden: false, reports: 0 }).eq('id', id);
  if (!hidden) await sb.from('timed_comment_reports').delete().eq('comment_id', id);
  revalidatePath('/admin/comments');
}

export async function deleteComment(id: string) {
  const { sb, isAdmin } = await requireStaff();
  if (!isAdmin) return;
  await sb.from('timed_comments').delete().eq('id', id);
  revalidatePath('/admin/comments');
}
