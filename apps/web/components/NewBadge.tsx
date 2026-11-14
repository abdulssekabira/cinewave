'use client';

import { useEffect, useState } from 'react';
import { newLabel } from '@cinewave/shared';

/** Red "NEW" label for 24 hours after a film (or a series episode) is added. Worked out in the
 *  visitor's browser, so it disappears on time even on pages the server has cached. */
export function NewBadge({ addedAt, episodeAt, kind }: { addedAt: string | null; episodeAt: string | null; kind?: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => { setLabel(newLabel({ added_at: addedAt, latest_episode_at: episodeAt, kind })); }, [addedAt, episodeAt, kind]);
  if (!label) return null;
  return <span className={`card-new${label !== 'NEW' ? ' ep' : ''}`}>{label}</span>;
}
