import { useEffect } from 'react';

export const TOAST_MS = 3000;

interface ToastProps {
  message: string;
  /** Called once the toast has shown for `ms`. */
  onDone: () => void;
  ms?: number;
}

/** Bottom-centre glass notice (triple six, "reduced motion is on"). */
export function Toast({ message, onDone, ms = TOAST_MS }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [message, ms, onDone]);
  return (
    <div className="toast glass" role="status" data-testid="toast">
      {message}
    </div>
  );
}
