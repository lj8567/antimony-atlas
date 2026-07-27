import type { ReactNode } from 'react';

/**
 * CSS-only tooltip that works for mouse and keyboard users. The bubble text
 * lives inside the focusable trigger, so screen readers announce it with the
 * trigger content without needing generated ids (safe in server components).
 */
export function Hint({ children, text }: { children: ReactNode; text: ReactNode }) {
  return (
    <span className="hint" tabIndex={0}>
      {children}
      <span className="hint-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
