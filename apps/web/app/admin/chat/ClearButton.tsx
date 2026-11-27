'use client';

import { useTransition } from 'react';
import { clearChatAction } from './actions';

export function ClearButton({ count }: { count: number }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-accent"
      disabled={busy}
      onClick={() => {
        if (confirm('Clear the whole chat for everyone? This can’t be undone.')) start(() => clearChatAction());
      }}
    >
      {busy ? 'Clearing…' : `Clear chat${count ? ` (${count} messages)` : ''}`}
    </button>
  );
}
