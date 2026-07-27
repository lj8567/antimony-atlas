import type { ReactNode } from 'react';

export function Panel({
  title,
  note,
  actions,
  flush = false,
  children,
}: {
  title?: ReactNode;
  note?: ReactNode;
  actions?: ReactNode;
  /** remove body padding (tables) */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {(title || note || actions) && (
        <header className="panel-head">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
          </div>
          <div className="inline-list">
            {note && <span className="panel-note">{note}</span>}
            {actions}
          </div>
        </header>
      )}
      <div className={flush ? 'panel-body flush' : 'panel-body'}>{children}</div>
    </section>
  );
}
