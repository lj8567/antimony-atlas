'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page">
      <div className="error-state" role="alert">
        <h3>Something went wrong</h3>
        <p>{error.message || 'An unexpected error occurred while rendering this page.'}</p>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={reset}>
            Try again
          </button>
        </p>
      </div>
    </div>
  );
}
