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
import { getLocale, t } from '../../i18n/i18n';
import { Divider, LangSwitch, Pill, Segmented, Toggle } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/Portrait';

const CONTROLLERS: readonly SeatController[] = ['human', 'bot', 'empty'];
const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

interface SetupScreenProps {
  muted: boolean;
  onStart: (config: GameConfig) => void;
  onBack: () => void;
  onToggleLanguage: () => void;
  onMute: () => void;
}

/** Four seats (human, bot or empty; hero; name) and the board level; Start needs two filled seats. */
export function SetupScreen({ muted, onStart, onBack, onToggleLanguage, onMute }: SetupScreenProps) {
  const [seats, setSeats] = useState(defaultSeats);
  const [level, setLevel] = useState<Level>('easy');
  const startable = canStart(seats);

  return (
    <main className="screen setup" data-testid="setup">
      <header className="screen-top">
        <Pill variant="outline" icon="arrow-left" data-testid="back" onClick={onBack}>
          {t('ui.back')}
        </Pill>
        <h1 className="h1 screen-title">{t('ui.chooseHeroes')}</h1>
        <div className="top-actions">
          <LangSwitch locale={getLocale()} onToggle={onToggleLanguage} />
          <Toggle
            checked={muted}
            onChange={onMute}
            label={t('ui.mute')}
            onIcon="speaker-off"
            offIcon="speaker"
            testId="setup-mute"
          />
        </div>
      </header>

      <div className="seats-grid">
        {seats.map((seat, k) => {
          const empty = seat.controller === 'empty';
          return (
            <section
              key={k}
              className={`seat-column glass${empty ? ' empty' : ''}`}
              style={{ ['--hero' as string]: HEROES[seat.hero].cssColor }}
              data-testid={`seat-${k}`}
              aria-label={t('ui.seat', { n: k + 1 })}
            >
              <div className="seat-label">
                <Icon
                  name={empty ? 'seat-empty' : seat.controller === 'bot' ? 'robot' : 'person'}
                  size={16}
                />
                {t('ui.seat', { n: k + 1 })}
              </div>
              <Segmented
                label={t('ui.seat', { n: k + 1 })}
                value={seat.controller}
                onChange={(value) => setSeats((all) => setController(all, k, value))}
                options={CONTROLLERS.map((value) => ({
                  value,
                  label: t(`ui.${value}`),
                  testId: `seat-${k}-${value}`,
                }))}
              />
              <div className="hero-picker">
                <button
                  type="button"
                  className="icon-btn glass small"
                  aria-label={t('ui.prevHero')}
                  disabled={empty}
                  onClick={() => setSeats((all) => cycleHero(all, k, -1))}
                >
                  <Icon name="chevron-left" />
                </button>
                <div className="portrait-stage">
                  <Portrait key={seat.hero} hero={seat.hero} empty={empty} className="hero-portrait" />
                </div>
                <button
                  type="button"
                  className="icon-btn glass small"
                  aria-label={t('ui.nextHero')}
                  disabled={empty}
                  onClick={() => setSeats((all) => cycleHero(all, k, 1))}
                >
                  <Icon name="chevron-right" />
                </button>
              </div>
              <div className="hero-name">{empty ? '—' : heroName(seat.hero)}</div>
              <label className={`name-field${empty ? ' hidden' : ''}`}>
                <span className="sr-only">{t('ui.name')}</span>
                <input
                  type="text"
                  maxLength={MAX_NAME_LENGTH}
                  disabled={empty}
                  placeholder={t('ui.name')}
                  aria-label={t('ui.seatName', { n: k + 1 })}
                  value={seat.name}
                  onChange={(event) => setSeats((all) => setName(all, k, event.target.value))}
                />
              </label>
            </section>
          );
        })}
      </div>

      <footer className="setup-footer">
        <span className="footer-label">
          <Icon name="robot" size={18} />
          {t('ui.difficulty')}
        </span>
        <Segmented
          label={t('ui.board')}
          value={level}
          onChange={setLevel}
          options={LEVELS.map((value) => ({ value, label: t(`ui.${value}`), testId: `level-${value}` }))}
        />
        <Divider className="footer-divider" />
        <Pill
          variant="primary"
          arrow
          data-testid="start"
          disabled={!startable}
          onClick={() => onStart(toGameConfig(seats, level))}
        >
          {t('ui.start')}
        </Pill>
      </footer>
    </main>
  );
}
