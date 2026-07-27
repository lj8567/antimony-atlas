import type { ReactNode } from 'react';

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-row">
        <div>
          {kicker && <p className="page-kicker">{kicker}</p>}
          <h1 className="page-title">{title}</h1>
          {description && <p className="page-sub">{description}</p>}
        </div>
        {actions && <div className="inline-list">{actions}</div>}
      </div>
    </header>
  );
}
