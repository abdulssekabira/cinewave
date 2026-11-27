import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/** GLE Chat: one public room for everyone. Shared by web and Android. */

export interface ChatMessage {
  id: number;
  user_id: string | null;
  author: string;
  badge: 'admin' | 'gold' | 'premium' | 'standard' | null;
  body: string;
  spoiler: boolean;
  created_at: string;
  deleted_at: string | null;
}

export const CHAT_ROOM = 'general';
const COLS = 'id, user_id, author, badge, body, spoiler, created_at, deleted_at';

export const CHAT_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  admin: { label: 'ADMIN', bg: '#e5192e', fg: '#fff' },
  gold: { label: 'GOLD', bg: '#d4a72c', fg: '#111' },
  premium: { label: 'PREMIUM', bg: '#7b5cff', fg: '#fff' },
  standard: { label: 'STANDARD', bg: '#2f6f9f', fg: '#fff' },
};

/** The latest messages, oldest first (ready to show top to bottom). */
export async function getChat(sb: SupabaseClient, limit = 80, beforeId?: number): Promise<ChatMessage[]> {
  let q = sb.from('chat_messages').select(COLS).eq('room', CHAT_ROOM).is('deleted_at', null)
    .order('id', { ascending: false }).limit(limit);
  if (beforeId) q = q.lt('id', beforeId);
  const { data } = await q;
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function sendChat(sb: SupabaseClient, body: string, spoiler = false): Promise<{ message?: ChatMessage; error?: string }> {
  const { data, error } = await sb.rpc('send_chat', { p_body: body, p_spoiler: spoiler });
  if (error) return { error: error.message.replace(/^.*?: /, '') || 'Could not send.' };
  return { message: data as ChatMessage };
}

export async function reportChat(sb: SupabaseClient, id: number) {
  await sb.rpc('report_chat', { p_id: id });
}

export async function deleteChatMessage(sb: SupabaseClient, id: number) {
  const { error } = await sb.rpc('admin_chat_delete', { p_id: id });
  return error?.message ?? null;
}

export async function clearChat(sb: SupabaseClient): Promise<string | null> {
  const { error } = await sb.rpc('admin_chat_clear');
  return error?.message ?? null;
}

export async function banFromChat(sb: SupabaseClient, userId: string, days: number | null) {
  const { error } = await sb.rpc('admin_chat_ban', { p_user: userId, p_days: days });
  return error?.message ?? null;
}

export async function getChatNotify(sb: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await sb.from('profiles').select('chat_notify').eq('id', userId).maybeSingle();
  return Boolean((data as { chat_notify?: boolean } | null)?.chat_notify);
}

export async function setChatNotify(sb: SupabaseClient, on: boolean) {
  const { error } = await sb.rpc('set_chat_notify', { p_on: on });
  return error?.message ?? null;
}

/**
 * Live updates: new messages, deletions and "clear chat", plus how many
 * people have the chat open. Returns a function that stops listening.
 */
export function subscribeChat(
  sb: SupabaseClient,
  handlers: {
    onMessage: (m: ChatMessage) => void;
    onRemove: (id: number) => void;
    onOnline?: (n: number) => void;
    presenceKey?: string;
  },
): () => void {
  const ch: RealtimeChannel = sb.channel(`chat:${CHAT_ROOM}`, {
    config: { presence: { key: handlers.presenceKey ?? `v-${Math.random().toString(36).slice(2)}` } },
  });
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room=eq.${CHAT_ROOM}` }, (p) => {
    const m = p.new as ChatMessage;
    if (!m.deleted_at) handlers.onMessage(m);
  });
  ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room=eq.${CHAT_ROOM}` }, (p) => {
    const m = p.new as ChatMessage;
    if (m.deleted_at) handlers.onRemove(m.id);
  });
  if (handlers.onOnline) {
    ch.on('presence', { event: 'sync' }, () => handlers.onOnline!(Object.keys(ch.presenceState()).length));
  }
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED' && handlers.onOnline) ch.track({ at: Date.now() }).catch(() => {});
  });
  return () => { sb.removeChannel(ch); };
}

/** "9:07" today, "Mon 9:07" this week, else "12 Nov". */
export function chatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  if (now.getTime() - d.getTime() < 6 * 864e5) return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${t}`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Stable avatar colour per name. */
export function chatColor(name: string): string {
  const palette = ['#3a6ea5', '#6b8f3a', '#a5503a', '#7b5cff', '#2f9f8f', '#b0487a', '#c27c2c', '#5a6b8f'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
