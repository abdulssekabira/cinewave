'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * A horizontally scrolling row with the reference layout: red-bar eyebrow,
 * title with an "All" link, and page dots that track and control scrolling.
 */
export function Row({
  eyebrow,
  label,
  href,
  wide,
  children,
}: {
  eyebrow?: string;
  label: string;
  href?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const track = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(1, Math.ceil((el.scrollWidth - 4) / el.clientWidth));
    setPages(n);
    const max = el.scrollWidth - el.clientWidth;
    setPage(max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (n - 1)));
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [measure]);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: pages > 1 ? (max * i) / (pages - 1) : 0 });
  };

  return (
    <section className="row" aria-labelledby={id}>
      <div className="row-head">
        <div>
          {eyebrow && <div className="row-eyebrow">{eyebrow}</div>}
          <h2 className="row-title" id={id}>
            {label}
            {href && <Link href={href} className="row-all">All</Link>}
          </h2>
        </div>
        {pages > 1 && (
          <div className="row-dots" role="group" aria-label={`${label} pages`}>
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Page ${i + 1} of ${pages}`}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>
      <div ref={track} className={`row-track${wide ? ' wide' : ''}`}>{children}</div>
    </section>
  );
}
