'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPopupNotifications, markNotifications, type AppNotification } from '@cinewave/shared';
import { browserClient } from '@/lib/supabase/browser';

/**
 * When a signed-in viewer comes back to the site, a small pop-up shows new
 * episodes of series they follow (once per notification).
 */
export function NewEpisodePopup() {
  const pathname = usePathname();
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (pathname.startsWith('/watch') || pathname.startsWith('/admin') || pathname.startsWith('/login')) return;
    let alive = true;
    const sb = browserClient();
    sb.auth.getSession().then(async (res: { data: { session: unknown } }) => {
      if (!res.data.session || !alive) return;
      const list = await getPopupNotifications(sb).catch(() => []);
      if (alive && list.length) setItems(list);
    });
    return () => { alive = false; };
  }, [pathname]);

  if (!items.length) return null;
  const close = () => {
    const ids = items.map((n) => n.id);
    setItems([]);
    markNotifications(browserClient(), { ids, read: false, popup: true }).catch(() => {});
  };
  const first = items[0];

  return (
    <div className="popup-back" role="dialog" aria-modal="true" aria-labelledby="popup-h" onClick={close}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        {first.image_url && <img src={first.image_url} alt="" className="popup-img" />}
        <div className="popup-body">
          <p className="popup-eyebrow">🔔 {items.length > 1 ? `${items.length} new episodes` : 'New episode'}</p>
          <h2 id="popup-h">{first.heading.replace(/^New episode: /, '')}</h2>
          {first.body && <p>{first.body}</p>}
          {items.length > 1 && (
            <ul className="popup-more">
              {items.slice(1, 4).map((n) => <li key={n.id}>{n.heading.replace(/^New episode: /, '')} · {n.body?.replace(/ is out now\.$/, '')}</li>)}
            </ul>
          )}
          <div className="a-row" style={{ marginTop: 14 }}>
            <Link href={first.link ?? '/notifications'} className="btn btn-accent" onClick={close}>Watch now</Link>
            {items.length > 1
              ? <Link href="/notifications" className="btn btn-gray" onClick={close}>See all</Link>
              : <button type="button" className="btn btn-gray" onClick={close}>Later</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
