'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';

/**
 * Right-hand slide-over used for source panels and record detail. Focus is
 * moved into the drawer on open and restored on close; Escape closes it.
 */
export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="drawer-overlay" aria-label="Close panel" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Detail panel'}>
        <div className="drawer-head">
          <h2 className="drawer-title">{title}</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="drawer-body" ref={panelRef} tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}
