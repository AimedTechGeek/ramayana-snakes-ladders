import { useState } from 'react';
import type { GameConfig, Level } from '../../core/types';
import { HEROES, heroName } from '../../game/heroes';
import {
  MAX_NAME_LENGTH,
  canStart,
  cycleHero,
  defaultSeats,
  setController,
  setName,
  toGameConfig,
  type SeatController,
} from '../../game/setupModel';
import { t } from '../../i18n/i18n';

const CONTROLLERS: readonly { value: SeatController; labelKey: string }[] = [
  { value: 'human', labelKey: 'ui.human' },
  { value: 'bot', labelKey: 'ui.bot' },
  { value: 'empty', labelKey: 'ui.empty' },
];
const LEVELS: readonly { value: Level; labelKey: string }[] = [
  { value: 'easy', labelKey: 'ui.easy' },
  { value: 'medium', labelKey: 'ui.medium' },
  { value: 'hard', labelKey: 'ui.hard' },
];

interface SetupScreenProps {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

/** Four seats (human, bot or empty; hero; name) and the board level; Start needs two filled seats. */
export function SetupScreen({ onStart, onBack }: SetupScreenProps) {
  const [seats, setSeats] = useState(defaultSeats);
  const [level, setLevel] = useState<Level>('easy');
  const startable = canStart(seats);

  return (
    <main className="screen setup" data-testid="setup">
      <header className="setup-header">
        <button className="btn chip" data-testid="back" onClick={onBack}>
          {t('ui.back')}
        </button>
        <h1 className="title small">{t('ui.title')}</h1>
      </header>
      <div className="seats-grid">
        {seats.map((seat, k) => {
          const empty = seat.controller === 'empty';
          return (
            <section key={k} className={`seat-column${empty ? ' empty' : ''}`} data-testid={`seat-${k}`}>
              <div className="seat-label">{t('ui.seat', { n: k + 1 })}</div>
              <div className="segments" role="radiogroup">
                {CONTROLLERS.map((option) => (
                  <button
                    key={option.value}
                    role="radio"
                    aria-checked={seat.controller === option.value}
                    className={`segment${seat.controller === option.value ? ' on' : ''}`}
                    data-testid={`seat-${k}-${option.value}`}
                    onClick={() => setSeats((all) => setController(all, k, option.value))}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
              <div className="hero-picker">
                <button
                  className="btn arrow"
                  aria-label="previous hero"
                  disabled={empty}
                  onClick={() => setSeats((all) => cycleHero(all, k, -1))}
                >
                  ‹
                </button>
                <div
                  className="portrait"
                  style={{ background: empty ? '#8a8a8a' : HEROES[seat.hero].cssColor }}
                >
                  {heroName(seat.hero).charAt(0)}
                </div>
                <button
                  className="btn arrow"
                  aria-label="next hero"
                  disabled={empty}
                  onClick={() => setSeats((all) => cycleHero(all, k, 1))}
                >
                  ›
                </button>
              </div>
              <div className="hero-caption" style={{ color: empty ? undefined : HEROES[seat.hero].cssColor }}>
                {heroName(seat.hero)}
              </div>
              {!empty && (
                <label className="name-field">
                  <span>{t('ui.name')}</span>
                  <input
                    type="text"
                    maxLength={MAX_NAME_LENGTH}
                    aria-label={t('ui.seatName', { n: k + 1 })}
                    value={seat.name}
                    onChange={(event) => setSeats((all) => setName(all, k, event.target.value))}
                  />
                </label>
              )}
            </section>
          );
        })}
      </div>
      <footer className="setup-footer">
        <span className="footer-label">{t('ui.board')}</span>
        <div className="segments" role="radiogroup">
          {LEVELS.map((option) => (
            <button
              key={option.value}
              role="radio"
              aria-checked={level === option.value}
              className={`segment${level === option.value ? ' on' : ''}`}
              data-testid={`level-${option.value}`}
              onClick={() => setLevel(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <button
          className="btn primary"
          data-testid="start"
          disabled={!startable}
          onClick={() => onStart(toGameConfig(seats, level))}
        >
          {t('ui.start')}
        </button>
      </footer>
    </main>
  );
}
