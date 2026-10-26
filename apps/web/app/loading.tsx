export default function Loading() {
  return (
    <div className="rows" style={{ paddingTop: 40 }} aria-busy="true" aria-label="Loading">
      {[0, 1].map((r) => (
        <div key={r} className="row">
          <div className="skeleton" style={{ height: 20, width: 160, borderRadius: 6, margin: '0 var(--gutter) 14px' }} />
          <div className="row-track">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="poster skeleton" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
