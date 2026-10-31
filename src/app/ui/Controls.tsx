// The shared controls: pill buttons, icon buttons, toggle, segmented control, divider and the language switch.

import { useRef, type ButtonHTMLAttributes, type KeyboardEvent } from 'react';
import type { Locale } from '../../i18n/i18n';
import { Icon, type IconName } from './Icon';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
  icon?: IconName;
  /** A trailing arrow that slides 3 px on hover. */
  arrow?: boolean;
}

/** `pill-primary` (white, ink text) or `pill-outline`. Extra props (data-testid, disabled, ...) go to the button. */
export function Pill({ variant = 'outline', icon, arrow = false, className, children, ...rest }: PillProps) {
  return (
    <button type="button" className={`pill ${variant}${className ? ` ${className}` : ''}`} {...rest}>
      {icon && <Icon name={icon} />}
      <span className="pill-label">{children}</span>
      {arrow && <Icon name="arrow-right" className="pill-arrow" />}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  icon: IconName;
  /** The accessible name; also the caption under the button when `caption` is set (desktop only, by CSS). */
  label: string;
  caption?: boolean;
  /** Toggle state (Fast, Mute): rendered as aria-pressed and a lit button. */
  pressed?: boolean;
}

/** `pill-icon`: a 44 x 44 round glass button. */
export function IconButton({ icon, label, caption = false, pressed, className, ...rest }: IconButtonProps) {
  return (
    <span className="tool">
      <button
        type="button"
        className={`icon-btn glass${pressed ? ' on' : ''}${className ? ` ${className}` : ''}`}
        aria-label={label}
        aria-pressed={pressed}
        title={label}
        {...rest}
      >
        <Icon name={icon} />
      </button>
      {caption && (
        <span className="tool-caption" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  /** Accessible name. */
  label: string;
  onIcon: IconName;
  offIcon: IconName;
  testId?: string;
}

/** The 56 x 30 glass switch with the state icon in its knob. */
export function Toggle({ checked, onChange, label, onIcon, offIcon, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      data-testid={testId}
      onClick={onChange}
    >
      <span className="toggle-track glass">
        <span className="toggle-knob">
          <Icon name={checked ? onIcon : offIcon} size={14} />
        </span>
      </span>
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  testId?: string;
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

function stepOf(key: string): number {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -1;
  return 0;
}

/** A glass pill group (radiogroup): arrow keys move the selection, Tab leaves the group. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent): void => {
    const step = stepOf(event.key);
    if (step === 0) return;
    event.preventDefault();
    const at = options.findIndex((option) => option.value === value);
    const next = options[(at + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() => group.current?.querySelector<HTMLElement>('[aria-checked=true]')?.focus());
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className={`segmented glass${className ? ` ${className}` : ''}`}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={`segment${option.value === value ? ' on' : ''}`}
          data-testid={option.testId}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The four-point star, inline SVG (never a font glyph). */
export function Sparkle({ size = 10 }: { size?: number }) {
  return (
    <svg className="sparkle" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.5c.7 5.8 4.7 9.8 10.5 10.5-5.8.7-9.8 4.7-10.5 10.5-.7-5.8-4.7-9.8-10.5-10.5C7.3 11.3 11.3 7.3 12 1.5z"
      />
    </svg>
  );
}

/** A hairline with a star at its right end. */
export function Divider({ className }: { className?: string }) {
  return (
    <div className={`divider${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="divider-line" />
      <Sparkle />
    </div>
  );
}

/** One button that switches the language; it shows both codes with the current one lit. */
export function LangSwitch({ locale, onToggle }: { locale: Locale; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="lang-switch glass"
      data-testid="language"
      aria-label={locale === 'en' ? 'हिंदी' : 'English'}
      onClick={onToggle}
    >
      <span className={locale === 'en' ? 'on' : ''}>EN</span>
      <span className={locale === 'hi' ? 'on' : ''}>हिं</span>
    </button>
  );
}
