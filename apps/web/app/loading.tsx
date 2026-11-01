/** Shown while a page is loading: the GLE Movies mark with a red progress line. */
export default function Loading() {
  return (
    <div className="gle-loading" role="status" aria-label="Loading">
      <div className="gle-loading-mark" aria-hidden="true">GLE<span>MOVIES</span></div>
      <div className="gle-loading-bar" aria-hidden="true"><div /></div>
    </div>
  );
}
