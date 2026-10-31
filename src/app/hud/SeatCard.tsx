// A seat card: portrait, name, square badge and controller tag. Glass; the active seat is lit with a saffron ring.

import type { Emotion } from '../../characters/reactions';
import type { Level } from '../../core/types';
import { HEROES } from '../../game/heroes';
import { t } from '../../i18n/i18n';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/Portrait';
import type { SeatInfo } from '../turn/ports';

export interface SeatCardProps {
  seat: SeatInfo;
  /** Seat index: the `data-testid` is `seat-card-{index}` (bubbles find their card by it). */
  index: number;
  active?: boolean;
  /** The hero's current emotion (placeholder mark on the portrait). */
  mood?: Emotion | null;
  /** Bot difficulty shown in the controller tag. */
  level?: Level;
  /** The Win row: a place badge instead of the board square. */
  result?: boolean;
}

/** The text a screen reader gets for the badge. */
export function badgeLabel(seat: SeatInfo): string {
  if (seat.rank !== null) return t(`ui.rank${seat.rank}`);
  return seat.position === 0 ? t('ui.atStart') : t('ui.square', { n: seat.position });
}

export function SeatCard({ seat, index, active = false, mood = null, level, result = false }: SeatCardProps) {
  const bot = seat.controller === 'bot';
  const tag = bot && level ? `${t('ui.bot')} · ${t(`ui.${level}`)}` : t(bot ? 'ui.bot' : 'ui.human');
  const ranked = seat.rank !== null;
  return (
    <li
      className={`seat-card glass${active ? ' active glass-strong' : ''}${result ? ' result' : ''}`}
      style={{ ['--hero' as string]: HEROES[seat.hero].cssColor }}
      data-testid={`${result ? 'win-seat' : 'seat-card'}-${index}`}
      aria-label={`${seat.name}, ${badgeLabel(seat)}`}
      aria-current={active ? 'true' : undefined}
    >
      <Portrait hero={seat.hero} emotion={mood} className="seat-portrait" />
      <span className="seat-name">{seat.name}</span>
      <span className="seat-tag">
        <Icon name={bot ? 'robot' : 'person'} size={12} />
        {tag}
      </span>
      <span className="seat-badge" aria-hidden="true">
        {ranked ? (
          <>
            <Icon name="trophy" size={12} />
            {t(`ui.rank${seat.rank}`)}
          </>
        ) : seat.position === 0 ? (
          <Icon name="gate" size={14} />
        ) : (
          seat.position
        )}
      </span>
    </li>
  );
}
