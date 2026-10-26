'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleWatchlist } from '@/app/title/[slug]/actions';
import { CheckIcon, PlusIcon } from './Icons';

export function WatchlistButton({ titleId, slug, initial }: { titleId: string; slug: string; initial: boolean }) {
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(initial);

  return (
    <button
      type="button"
      className="btn btn-gray"
      aria-pressed={on}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          await toggleWatchlist(titleId, slug, !on);
        })
      }
    >
      {on ? <CheckIcon size={20} /> : <PlusIcon size={20} />}
      My List
    </button>
  );
}
