/**
 * External source link: opens in a new tab with rel protections, keeps the
 * full title, and visibly marks that it leaves the application.
 */
export function SourceLink({
  url,
  title,
  className,
}: {
  url: string | null | undefined;
  title: string;
  className?: string;
}) {
  if (!url) {
    return <span className="note">Source URL not recorded</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `external-link ${className}` : 'external-link'}
    >
      {title}
      <svg viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M4.5 2H2v8h8V7.5M7 1.5h3.5V5M10.2 1.8 5.5 6.5" />
      </svg>
      <span className="visually-hidden">(opens external site in a new tab)</span>
    </a>
  );
}
