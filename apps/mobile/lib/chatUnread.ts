import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { countUnreadChat } from '@cinewave/shared';
import { supabase } from './supabase';

/** Unread messages for the Chat tab badge. The newest seen id is kept on the phone. */
const KEY = 'gle:chatSeen';
let seen: number | null = null;
let loaded = false;
let count = 0;
let onChat = false;
const subs = new Set<(n: number) => void>();
const emit = () => subs.forEach((f) => f(onChat ? 0 : count));

async function load() {
  if (loaded) return;
  loaded = true;
  const v = Number(await AsyncStorage.getItem(KEY).catch(() => null));
  seen = v > 0 ? v : null;
}

export async function refreshChatUnread() {
  await load();
  const uid = (await supabase.auth.getSession()).data.session?.user.id ?? null;
  count = onChat ? 0 : await countUnreadChat(supabase, seen, uid).catch(() => count);
  emit();
}

/** The Chat screen calls this with the newest message it shows. */
export function markChatSeen(id: number) {
  if (!id || (seen ?? 0) >= id) return;
  seen = id;
  count = 0;
  AsyncStorage.setItem(KEY, String(id)).catch(() => {});
  emit();
}

export function setOnChat(v: boolean) {
  onChat = v;
  if (v) count = 0;
  emit();
}

/** Badge number; checks when the app opens or comes back, and every minute. */
export function useChatUnread() {
  const [n, setN] = useState(0);
  useEffect(() => {
    subs.add(setN);
    refreshChatUnread();
    const t = setInterval(refreshChatUnread, 60_000);
    const a = AppState.addEventListener('change', (s) => { if (s === 'active') refreshChatUnread(); });
    return () => { subs.delete(setN); clearInterval(t); a.remove(); };
  }, []);
  return n;
}
