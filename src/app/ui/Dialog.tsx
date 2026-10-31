import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  labelledBy: string;
  testId?: string;
  className?: string;
  /** Overlay without the glass box (the Win screen): the content composes the page itself. */
  bare?: boolean;
  /** The scrim dims less (the Win screen keeps the board visible). */
  light?: boolean;
  children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href]';

/** Modal over a scrim: focus moves in, Tab wraps inside, and focus returns to the opener on close. */
export function Dialog({ labelledBy, testId, className, bare, light, children }: DialogProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const tabbable = (): HTMLElement[] =>
      [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.tabIndex >= 0);
    (element.querySelector<HTMLElement>('[data-autofocus]') ?? tabbable()[0])?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;
      const items = tabbable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    element.addEventListener('keydown', onKeyDown);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);
  return (
    <div className={`scrim${light ? ' light' : ''}`} data-testid={testId}>
      <div
        ref={box}
        className={`dialog${bare ? ' bare' : ' glass glass-strong'}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}
