'use client';

import { useState } from 'react';

/** Invite link with Copy and Share buttons. */
export function InviteActions({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Watch movies and series with VJs on GLE Movies. Sign up with my link: ${link}`;
  return (
    <div className="invite-actions">
      <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Your invite link" />
      <div className="a-row">
        <button
          type="button"
          className="btn btn-gray btn-small"
          onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* old browser */ }
          }}
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <button
          type="button"
          className="btn btn-accent btn-small"
          onClick={() => {
            if (navigator.share) navigator.share({ title: 'GLE Movies', text, url: link }).catch(() => {});
            else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          }}
        >
          Share
        </button>
        <a className="btn btn-gray btn-small" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
    </div>
  );
}
