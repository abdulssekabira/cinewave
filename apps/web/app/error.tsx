'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page">
      <div className="empty">
        <h2>Something went wrong</h2>
        <p>We couldn’t load this page. Check your connection and try again.</p>
        <button className="btn btn-accent" style={{ marginTop: 16 }} onClick={reset}>Retry</button>
      </div>
    </div>
  );
}
