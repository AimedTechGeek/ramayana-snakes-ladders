// The HUD overlay over the 3D canvas: seats, turn banner and hint, the dice, Fast / Mute / Menu, camera Fit / Focus.
// The overlay root lets pointer events through to the canvas; only its controls take them.

import type { Emotion } from '../../characters/reactions';
import { HEROES, heroName } from '../../game/heroes';
import { t } from '../../i18n/i18n';
import type { DioramaView } from '../board3d/DioramaView';
import type { HudState } from './HudStore';

/** Placeholder marks for a seat's current emotion. */
export const EMOTION_MARK: Record<Emotion, string> = {
  idle: '·',
  happy: '☺',
  excited: '✦',
  scared: '!',
  sad: '…',
};

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value }: { value: number }) {
  const on = PIPS[value] ?? [];
  return (
    <span className="die-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={on.includes(i) ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}

interface HudProps {
  hud: HudState;
  view: DioramaView;
  onRoll: () => void;
  onFast: () => void;
  onMute: () => void;
  onMenu: () => void;
  onFit: () => void;
  onFocus: () => void;
}

export function Hud({ hud, view, onRoll, onFast, onMute, onMenu, onFit, onFocus }: HudProps) {
  const { dice } = hud;
  return (
    <div className="hud" data-testid="hud">
      <ol className="seat-cards">
        {hud.seats.map((seat, i) => {
          const mood = view.moods[i];
          const bubble = view.bubbles[i];
          return (
            <li
              key={i}
              className={`seat-card${hud.current === i ? ' current' : ''}`}
              style={{ borderColor: hud.current === i ? undefined : HEROES[seat.hero].cssColor }}
              data-testid={`seat-card-${i}`}
            >
              <span className="seat-dot" style={{ background: HEROES[seat.hero].cssColor }}>
                {mood ? EMOTION_MARK[mood.emotion] : ''}
              </span>
              <span className="seat-name">{seat.name}</span>
              <span className="seat-meta">
                {heroName(seat.hero)} · {t(seat.controller === 'bot' ? 'ui.bot' : 'ui.human')}
              </span>
              <span className="seat-position">
                {seat.rank !== null
                  ? t(`ui.rank${seat.rank}`)
                  : seat.position === 0
                    ? t('ui.atStart')
                    : t('ui.square', { n: seat.position })}
              </span>
              {bubble && <span className="bubble">{bubble.line}</span>}
            </li>
          );
        })}
      </ol>

      <div className="turn-panel">
        <div className="banner" data-testid="banner">
          {hud.current >= 0 && hud.seats[hud.current] && (
            <span
              className="banner-dot"
              style={{ background: HEROES[hud.seats[hud.current]!.hero].cssColor }}
            />
          )}
          {hud.banner}
        </div>
        {hud.hint && <div className="hint">{hud.hint}</div>}
      </div>

      <div className="controls">
        <button className={`btn chip${hud.fast ? ' on' : ''}`} data-testid="fast" onClick={onFast}>
          {hud.fast ? '»» ' : '» '}
          {t('ui.fast')}
        </button>
        <button className={`btn chip${hud.muted ? ' on' : ''}`} data-testid="mute" onClick={onMute}>
          {hud.muted ? `✕ ${t('ui.muted')}` : `♪ ${t('ui.mute')}`}
        </button>
        <button className="btn chip" data-testid="menu" onClick={onMenu}>
          {t('ui.menu')}
        </button>
      </div>

      <div className="camera-buttons">
        <button className="btn chip" data-testid="fit" onClick={onFit}>
          {t('ui.fit')}
        </button>
        <button className="btn chip" data-testid="focus" onClick={onFocus}>
          {t('ui.focus')}
        </button>
      </div>

      <button
        key={dice.roll}
        className={`dice${dice.rolling ? ' rolling' : ''}${!dice.rolling && dice.value === 6 && dice.roll > 0 ? ' six' : ''}`}
        data-testid="dice"
        aria-label={t('ui.rollHint')}
        disabled={!hud.diceEnabled}
        onClick={onRoll}
      >
        <Die value={dice.value} />
      </button>
    </div>
  );
}
