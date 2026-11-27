'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { subscribeChat } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

const EVT = 'gle:chat-notify';

/** Called by the chat page when the viewer switches notifications on or off. */
export function setWebChatNotify(on: boolean) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: on }));
}

/**
 * While the website is open (any page, any tab), shows a browser notification
 * for new chat messages, at most once a minute, if the viewer switched them on.
 */
export function ChatNotifier({ userId, enabled }: { userId: string; enabled: boolean }) {
  const sb = browserClient();
  const path = usePathname();
  const [on, setOn] = useState(enabled);

  useEffect(() => {
    const h = (e: Event) => setOn(Boolean((e as CustomEvent).detail));
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);

  useEffect(() => {
    if (!on || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let last = 0;
    return subscribeChat(sb, {
      onMessage: (m) => {
        if (m.user_id === userId) return;
        if (path === '/chat' && !document.hidden) return;
        if (Date.now() - last < 60_000) return;
        last = Date.now();
        try {
          const n = new Notification('GLE Chat', {
            body: m.spoiler ? `${m.author}: (spoiler)` : `${m.author}: ${m.body.slice(0, 120)}`,
            icon: '/icon.png',
            tag: 'gle-chat',
          });
          n.onclick = () => { window.focus(); window.location.href = '/chat'; };
        } catch { /* some phones only allow notifications from an installed app */ }
      },
      onRemove: () => {},
    });
  }, [on, sb, userId, path]);

  return null;
}
