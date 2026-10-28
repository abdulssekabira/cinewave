export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 30, width: 180, borderRadius: 8, marginBottom: 24 }} />
      <div className="a-stats">
        {[0, 1, 2, 3].map((i) => <div key={i} className="a-stat skeleton" style={{ height: 88 }} />)}
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
    </div>
  );
}
