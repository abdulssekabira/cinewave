import type { ReactNode } from 'react';

export function Row({ label, children }: { label: string; children: ReactNode }) {
  const id = `row-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className="row" aria-labelledby={id}>
      <h2 id={id}>{label}</h2>
      <div className="row-track">{children}</div>
    </section>
  );
}
