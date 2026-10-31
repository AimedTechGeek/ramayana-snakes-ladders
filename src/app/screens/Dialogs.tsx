import { rankingOf } from '../../core/game';
import { HEROES } from '../../game/heroes';
import { t } from '../../i18n/i18n';
import type { GameResult } from '../turn/ports';

interface MenuDialogProps {
  fast: boolean;
  muted: boolean;
  onContinue: () => void;
  onFast: () => void;
  onMute: () => void;
  onMainMenu: () => void;
}

/** Pause menu: the game holds (no roll starts) while it is open; the game is autosaved, so Main Menu can Resume. */
export function MenuDialog({ fast, muted, onContinue, onFast, onMute, onMainMenu }: MenuDialogProps) {
  return (
    <div className="dialog-scrim" data-testid="menu-dialog">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <h2 id="menu-title">{t('ui.paused')}</h2>
        <button className="btn primary" data-testid="continue" onClick={onContinue} autoFocus>
          {t('ui.continue')}
        </button>
        <div className="dialog-row">
          <button className={`btn chip${fast ? ' on' : ''}`} onClick={onFast}>
            {t('ui.fast')}
          </button>
          <button className={`btn chip${muted ? ' on' : ''}`} onClick={onMute}>
            {muted ? t('ui.muted') : t('ui.mute')}
          </button>
        </div>
        <button className="btn" data-testid="main-menu" onClick={onMainMenu}>
          {t('ui.mainMenu')}
        </button>
      </div>
    </div>
  );
}

interface WinDialogProps {
  result: GameResult;
  onPlayAgain: () => void;
  onPlayOn: () => void;
  onMenu: () => void;
}

/** The winner, everyone's place (finished by rank, the rest by how far they got), Play Again, Play On, Menu. */
export function WinDialog({ result, onPlayAgain, onPlayOn, onMenu }: WinDialogProps) {
  const { players } = result.state;
  const places = rankingOf(players);
  const winner = players.find((player) => player.rank === 1) ?? players[places[0] ?? 0];
  return (
    <div className="dialog-scrim" data-testid="win">
      <div className="dialog win-dialog" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <div className="confetti" aria-hidden="true" />
        <h2 id="win-title">
          <span
            className="seat-dot big"
            style={{ background: winner ? HEROES[winner.hero].cssColor : undefined }}
          />
          {t('ui.winner', { name: winner?.name ?? '' })}
        </h2>
        <ol className="places">
          {places.map((index, place) => {
            const player = players[index];
            if (!player) return null;
            return (
              <li key={index}>
                <span className="seat-dot" style={{ background: HEROES[player.hero].cssColor }} />
                <span className="place">{t(`ui.rank${place + 1}`)}</span> {player.name}
              </li>
            );
          })}
        </ol>
        <div className="dialog-row">
          <button className="btn primary" data-testid="play-again" onClick={onPlayAgain}>
            {t('ui.playAgain')}
          </button>
          {result.canContinue && (
            <button className="btn" data-testid="play-on" onClick={onPlayOn}>
              {t('ui.playOn')}
            </button>
          )}
          <button className="btn" data-testid="win-menu" onClick={onMenu}>
            {t('ui.menu')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen prompt while the window is portrait; the game holds underneath. */
export function RotatePrompt() {
  return (
    <div className="rotate" data-testid="rotate" role="alert">
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <rect x="40" y="26" width="40" height="68" rx="8" fill="none" stroke="#f3e3b8" strokeWidth="6" />
        <path d="M20 70 A42 42 0 0 1 60 18" fill="none" stroke="#f0a35e" strokeWidth="6" />
      </svg>
      <p>{t('ui.rotate')}</p>
    </div>
  );
}
