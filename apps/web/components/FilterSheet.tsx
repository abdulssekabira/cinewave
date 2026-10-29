'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { posterPalette } from '@cinewave/shared';

export type FilterOption = {
  value: string; // '' = "all"
  label: string;
  count?: number;
  image?: string | null; // VJ photo
  avatar?: boolean; // show a round picture / initials
};

/**
 * A dark, thumb-friendly picker that replaces the phone's plain list.
 * Opens as a sheet from the bottom on phones and a panel on wide screens.
 * Choosing an option updates the page straight away (no Search button).
 */
export function FilterSheet({
  param,
  title,
  options,
  current,
}: {
  param: string;
  title: string;
  options: FilterOption[];
  current: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === current) ?? options[0];
  const active = current !== '' && current !== options[0].value;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = listRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?? listRef.current?.querySelector<HTMLButtonElement>('button');
    first?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function choose(value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(param, value);
    else next.delete(param);
    setOpen(false);
    router.push(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  }

  return (
    <>
      <button
        type="button"
        className={`fs-trigger${active ? ' on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {selected.avatar && active && <Avatar option={selected} size={22} />}
        <span className="fs-trigger-label">{selected.label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="fs-layer" onClick={() => setOpen(false)}>
          <div
            className="fs-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fs-grip" aria-hidden="true" />
            <div className="fs-head">
              <h2 id={`${id}-t`}>{title}</h2>
              <button type="button" className="fs-close" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="fs-list" ref={listRef} role="radiogroup" aria-labelledby={`${id}-t`}>
              {options.map((o) => {
                const on = o.value === selected.value;
                return (
                  <button
                    key={o.value || 'all'}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`fs-opt${on ? ' on' : ''}`}
                    onClick={() => choose(o.value)}
                  >
                    {o.avatar && <Avatar option={o} size={40} />}
                    <span className="fs-opt-label">{o.label}</span>
                    {typeof o.count === 'number' && <span className="fs-count">{o.count}</span>}
                    <span className="fs-check" aria-hidden="true">
                      {on && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({ option, size }: { option: FilterOption; size: number }) {
  if (!option.value) {
    return (
      <span className="fs-avatar all" style={{ width: size, height: size }} aria-hidden="true">
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M3.5 19c.6-3 3-4.6 5.5-4.6S13.9 16 14.5 19M14 15.2c2.6-.6 5.6.5 6.5 3.8" /></svg>
      </span>
    );
  }
  if (option.image) {
    return <img className="fs-avatar" src={option.image} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  const p = posterPalette(option.value);
  const initials = option.label.replace(/^VJ\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="fs-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${p.from}, ${p.to})`, color: p.accent }}
    >
      {initials}
    </span>
  );
}
