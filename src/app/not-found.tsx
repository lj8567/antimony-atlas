import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <h3>Page not found</h3>
        <p>The record or page you requested does not exist in the atlas.</p>
        <p style={{ marginTop: 12 }}>
          <Link className="btn" href="/">
            Back to overview
          </Link>
        </p>
      </div>
    </div>
  );
}
