'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden>
    {path}
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: icon(<path d="M2 8.5 8 3l6 5.5M4 7.5V13h8V7.5" />) },
  { href: '/assets', label: 'Assets', icon: icon(<><path d="M2 13h12" /><path d="M3.5 13V6.5L7 9V6.5l3.5 2.5V5.5L13 4v9" /></>) },
  { href: '/map', label: 'Map', icon: icon(<><path d="M2 4l4-1.5L10 4l4-1.5v9L10 13 6 11.5 2 13z" /><path d="M6 2.5v9M10 4v9" /></>) },
  { href: '/countries', label: 'Countries', icon: icon(<><circle cx="8" cy="8" r="6" /><path d="M2 8h12M8 2c1.8 1.7 2.7 3.8 2.7 6S9.8 12.3 8 14c-1.8-1.7-2.7-3.8-2.7-6S6.2 3.7 8 2z" /></>) },
  { href: '/trade', label: 'Trade', icon: icon(<><path d="M2 5.5h9M9 3l2.5 2.5L9 8" /><path d="M14 10.5H5M7 8 4.5 10.5 7 13" /></>) },
  { href: '/events', label: 'Events', icon: icon(<><path d="M8 2 1.8 13h12.4z" /><path d="M8 6.5v3M8 11.3v.4" /></>) },
  { href: '/sources', label: 'Sources', icon: icon(<><path d="M3 2.5h7L13 5.5V13.5H3z" /><path d="M10 2.5v3h3M5 8h6M5 10.5h6" /></>) },
  { href: '/methodology', label: 'Methodology', icon: icon(<><circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5v.4" /></>) },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebar = (
    <aside className={mobileOpen ? 'app-sidebar mobile-open' : 'app-sidebar'} aria-label="Primary">
      <div className="brand">
        <Link href="/" className="brand-mark" onClick={() => setMobileOpen(false)}>
          <span className="brand-symbol" aria-hidden>
            Sb
          </span>
          <span className="brand-name">
            Antimony Supply
            <br />
            Risk Atlas
          </span>
        </Link>
        <p className="brand-scope">Pilot · non-Chinese supply · public sources</p>
      </div>
      <nav className="app-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        Source-audited intelligence on the antimony supply chain. Reported, modelled and unverified values are always
        distinguished.
      </div>
    </aside>
  );

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {sidebar}
      {mobileOpen && (
        <button type="button" className="nav-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      )}
      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="menu-button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              {mobileOpen ? <path d="M3 3l10 10M13 3 3 13" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
            </svg>
          </button>
          <div>
            <div className="topbar-title">Antimony Supply Risk Atlas</div>
            <div className="topbar-scope">Pilot · Sb · public sources</div>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </div>
    </div>
  );
}
