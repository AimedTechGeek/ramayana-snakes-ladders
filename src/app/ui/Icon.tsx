// Inline-SVG icons from the one sprite sheet public/icons.svg (<symbol id="i-name">).

export type IconName =
  | 'dice'
  | 'roll'
  | 'speaker'
  | 'speaker-off'
  | 'fast'
  | 'normal'
  | 'menu'
  | 'close'
  | 'fit'
  | 'focus'
  | 'globe'
  | 'person'
  | 'robot'
  | 'seat-empty'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-left'
  | 'chevron-right'
  | 'rotate-phone'
  | 'trophy'
  | 'sparkle'
  | 'heart'
  | 'drop'
  | 'bolt'
  | 'exclamation'
  | 'play'
  | 'pause'
  | 'gallery'
  | 'gate';

const SPRITE = `${import.meta.env.BASE_URL}icons.svg`;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`${SPRITE}#i-${name}`} />
    </svg>
  );
}
