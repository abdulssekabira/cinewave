'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';

export async function clearChatAction() {
  const { sb } = await requireAdmin();
  await sb.rpc('admin_chat_clear');
  revalidatePath('/admin/chat');
  revalidatePath('/chat');
}

export async function deleteChatAction(id: number) {
  const { sb } = await requireAdmin();
  await sb.rpc('admin_chat_delete', { p_id: id });
  revalidatePath('/admin/chat');
}

export async function banChatAction(userId: string, days: number | null) {
  const { sb } = await requireAdmin();
  await sb.rpc('admin_chat_ban', { p_user: userId, p_days: days });
  revalidatePath('/admin/chat');
}

export async function unbanChatAction(userId: string) {
  const { sb } = await requireAdmin();
  await sb.rpc('admin_chat_unban', { p_user: userId });
  revalidatePath('/admin/chat');
}
