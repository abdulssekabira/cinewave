'use client';

import { useEffect, useState } from 'react';
import { countUnreadChat } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

const KEY = 'gle:chatSeen';
const EVT = 'gle:chat-seen';

function readSeen(): number | null {
  try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null; } catch { return null; }
}

/** The chat page calls this with the newest message it shows. */
export function markChatSeen(id: number) {
  if (!id) return;
  try { if ((readSeen() ?? 0) < id) localStorage.setItem(KEY, String(id)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVT));
}

/** Number of new chat messages for the menu badge (checked every minute). */
export function useChatUnread(userId: string | null, onChatPage: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (onChatPage) { setN(0); return; }
    const sb = browserClient();
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      const c = await countUnreadChat(sb, readSeen(), userId).catch(() => 0);
      if (alive) setN(c);
    };
    check();
    const t = setInterval(check, 60_000);
    const onSeen = () => setN(0);
    window.addEventListener(EVT, onSeen);
    document.addEventListener('visibilitychange', check);
    return () => { alive = false; clearInterval(t); window.removeEventListener(EVT, onSeen); document.removeEventListener('visibilitychange', check); };
  }, [userId, onChatPage]);
  return n;
}
