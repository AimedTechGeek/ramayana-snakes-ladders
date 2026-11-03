import { rankingOf } from '../../core/game';
import { getLocale, t } from '../../i18n/i18n';
import { SeatCard } from '../hud/SeatCard';
import type { GameResult, SeatInfo } from '../turn/ports';
import { Divider, IconButton, LangSwitch, Pill, Segmented, Sparkle, Toggle } from '../ui/Controls';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

interface MenuDialogProps {
  fast: boolean;
  muted: boolean;
  /** "Bite close-ups" (T45.4): the camera glides in for a snake's bite. */
  biteCloseUps: boolean;
  onContinue: () => void;
  onFast: () => void;
  onMute: () => void;
  onBiteCloseUps: () => void;
  /** New Game: leaves for Setup (the autosave stays until a new game starts). */
  onNewGame: () => void;
  onFit: () => void;
  onFocus: () => void;
  onLanguage: () => void;
}

/** Pause menu: the game holds (no roll starts) while it is open. */
export function MenuDialog({
  fast,
  muted,
  biteCloseUps,
  onContinue,
  onFast,
  onMute,
  onBiteCloseUps,
  onNewGame,
  onFit,
  onFocus,
  onLanguage,
}: MenuDialogProps) {
  return (
    <Dialog labelledBy="menu-title" testId="menu-dialog" className="menu-dialog">
      <h2 id="menu-title">{t('ui.menu')}</h2>
      <Divider />
      <div className="dialog-rows">
        <div className="row">
          <span className="row-label">{t('ui.speed')}</span>
          <Segmented
            label={t('ui.speed')}
            value={fast ? 'fast' : 'normal'}
            onChange={(next) => {
              if (next !== (fast ? 'fast' : 'normal')) onFast();
            }}
            options={[
              { value: 'normal', label: t('ui.normal'), testId: 'speed-normal' },
              { value: 'fast', label: t('ui.fast'), testId: 'speed-fast' },
            ]}
          />
        </div>
        <div className="row">
          <span className="row-label">{t('ui.mute')}</span>
          <Toggle
            checked={muted}
            onChange={onMute}
            label={t('ui.mute')}
            onIcon="speaker-off"
            offIcon="speaker"
            testId="menu-mute"
          />
        </div>
        <div className="row">
          <span className="row-label">{t('ui.biteCloseUps')}</span>
          <Toggle
            checked={biteCloseUps}
            onChange={onBiteCloseUps}
            label={t('ui.biteCloseUps')}
            onIcon="focus"
            offIcon="close"
            testId="menu-close-ups"
          />
        </div>
        <div className="row">
          <span className="row-label">{t('ui.language')}</span>
          <LangSwitch locale={getLocale()} onToggle={onLanguage} />
        </div>
        <div className="row">
          <span className="row-label">{t('ui.camera')}</span>
          <span className="row-actions">
            <IconButton icon="fit" label={t('ui.fit')} data-testid="menu-fit" onClick={onFit} />
            <IconButton icon="focus" label={t('ui.focus')} data-testid="menu-focus" onClick={onFocus} />
          </span>
        </div>
      </div>
      <div className="dialog-actions">
        <Pill variant="outline" data-testid="main-menu" onClick={onNewGame}>
          {t('ui.newGame')}
        </Pill>
        <Pill variant="primary" data-testid="continue" data-autofocus arrow onClick={onContinue}>
          {t('ui.resume')}
        </Pill>
      </div>
    </Dialog>
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
    <Dialog labelledBy="win-title" testId="win" className="win-screen" bare light>
      <div className="win-sparkles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>
      <h1 id="win-title" className="win-title">
        <Sparkle size={16} />
        <span>{t('ui.winner', { name: winner?.name ?? '' })}</span>
        <Sparkle size={16} />
      </h1>
      <Divider className="win-divider" />
      <ol className="win-places">
        {places.map((index, place) => {
          const player = players[index];
          if (!player) return null;
          const seat: SeatInfo = {
            name: player.name,
            hero: player.hero,
            controller: player.controller,
            position: player.position,
            rank: player.rank ?? null,
          };
          return <SeatCard key={index} seat={seat} index={place} result active={place === 0} />;
        })}
      </ol>
      <div className="win-actions">
        <Pill variant="primary" data-testid="play-again" data-autofocus arrow onClick={onPlayAgain}>
          {t('ui.playAgain')}
        </Pill>
        {result.canContinue && (
          <Pill variant="outline" data-testid="play-on" onClick={onPlayOn}>
            {t('ui.playOn')}
          </Pill>
        )}
        <Pill variant="outline" data-testid="win-menu" onClick={onMenu}>
          {t('ui.menu')}
        </Pill>
      </div>
    </Dialog>
  );
}

/** Full-screen prompt while the window is portrait; the game holds underneath. */
export function RotatePrompt() {
  return (
    <div className="rotate" data-testid="rotate" role="alert">
      <Icon name="rotate-phone" size={120} className="rotate-icon" />
      <h2>{t('ui.rotate')}</h2>
      <Divider />
    </div>
  );
}
