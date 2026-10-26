import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <h2>We couldn’t find that</h2>
        <p>The title may have left the catalogue or the link is wrong.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Back to home</Link>
      </div>
    </div>
  );
}
