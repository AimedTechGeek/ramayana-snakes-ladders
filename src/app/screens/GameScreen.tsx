// The game: the 3D board, the HUD over it, the pause menu and the Win dialog, around one TurnController.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameConfig } from '../../core/types';
import { getAudio } from '../../game/audio';
import { clearSave } from '../../game/save';
import { t } from '../../i18n/i18n';
import { bridge, controllerStarted } from '../appHooks';
import { BoardCanvas } from '../board3d/BoardCanvas';
import type { DieHandle } from '../board3d/Die';
import { DioramaView } from '../board3d/DioramaView';
import type { ScreenPoint } from '../hud/bubbleLayout';
import { Hud } from '../hud/Hud';
import { HudStore } from '../hud/HudStore';
import { TurnController, type TurnStart } from '../turn/TurnController';
import { Toast } from '../ui/Toast';
import { MenuDialog, WinDialog } from './Dialogs';

interface GameScreenProps {
  start: TurnStart;
  fast: boolean;
  muted: boolean;
  /** The portrait prompt is up: hold the game. */
  portrait: boolean;
  onFast: () => void;
  onMute: () => void;
  onLanguage: () => void;
  /** Leave for Setup (the menu's New Game). */
  onNewGame: () => void;
  onExit: () => void;
  onPlayAgain: (config: GameConfig) => void;
  /** Speech-bubble anchors (a token's head in viewport px, per seat); see `HudProps.bubbleAnchors`. */
  bubbleAnchors?: readonly (ScreenPoint | null | undefined)[];
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function GameScreen({
  start,
  fast,
  muted,
  portrait,
  onFast,
  onMute,
  onLanguage,
  onNewGame,
  onExit,
  onPlayAgain,
  bubbleAnchors,
}: GameScreenProps) {
  const [view] = useState(() => new DioramaView(getAudio()));
  const [hudStore] = useState(() => new HudStore());
  const [reducedMotion] = useState(prefersReducedMotion);
  const controller = useRef<TurnController | null>(null);
  const die = useRef<DieHandle | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(() =>
    prefersReducedMotion() ? t('ui.reducedMotion') : null,
  );
  const hud = useSyncExternalStore(hudStore.subscribe, hudStore.getSnapshot);
  useSyncExternalStore(view.subscribe, view.getVersion);
  const level = 'config' in start ? start.config.level : start.state.level;

  // One controller per game; Fast and Mute are read once here and followed by the effects below.
  useEffect(() => {
    const audio = getAudio(muted);
    const turns = new TurnController(start, { view, hud: hudStore, audio }, { fast, muted });
    controller.current = turns;
    void turns.start().then(() => {
      if (controller.current === turns) controllerStarted(turns);
    });
    return () => {
      turns.dispose();
      if (bridge.controller === turns) bridge.controller = null;
      controller.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, view, hudStore]);

  useEffect(() => {
    // The tray's 3D die tumbles every roll once it is mounted; until then the Roll pill stands in.
    hudStore.setDie((value, fast, turn) => die.current?.roll(value, fast, turn) ?? Promise.resolve());
    bridge.view = view;
    return () => {
      if (bridge.view === view) bridge.view = null;
      hudStore.setDie(null);
      view.dispose();
      hudStore.dispose();
    };
  }, [view, hudStore]);
  useEffect(() => controller.current?.setFast(fast), [fast]);
  useEffect(() => controller.current?.setMuted(muted), [muted]);
  useEffect(() => controller.current?.setPaused(menuOpen || portrait), [menuOpen, portrait]);
  useEffect(() => {
    bridge.menuOpen = menuOpen;
    bridge.winShown = hud.result !== null;
    view.setWinShown(hud.result !== null);
  }, [menuOpen, hud.result, view]);
  useEffect(() => {
    if (hud.hint === t('ui.tripleSix')) setToast(hud.hint);
  }, [hud.hint]);
  const clearToast = useCallback(() => setToast(null), []);

  const roll = () => void controller.current?.requestRoll();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return;
      getAudio().unlock();
      if (event.key === ' ' || event.key === 'Enter') {
        // A focused button keeps its own Space / Enter; elsewhere they roll.
        if (menuOpen || hud.result || event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        void controller.current?.requestRoll();
      } else if (event.key === 'f' || event.key === 'F') onFast();
      else if (event.key === 'm' || event.key === 'M') onMute();
      else if (event.key === 'Escape') setMenuOpen((open) => !open);
      else if (event.key === '0') view.camera?.fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, hud.result, onFast, onMute, view]);

  const result = hud.result;
  const focusCurrent = () => view.camera?.focus(Math.max(0, hud.current));
  return (
    <main className="screen game" data-testid="game">
      <BoardCanvas
        view={view}
        dieRef={die}
        dieIdle={hud.diceEnabled && !result}
        onDieTap={roll}
        reducedMotion={reducedMotion}
      />
      {!result && (
        <Hud
          hud={hud}
          view={view}
          level={level}
          bubbleAnchors={bubbleAnchors}
          onRoll={roll}
          onFast={onFast}
          onMute={onMute}
          onMenu={() => setMenuOpen(true)}
          onFit={() => view.camera?.fit()}
          onFocus={focusCurrent}
          onLanguage={onLanguage}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
      {menuOpen && (
        <MenuDialog
          fast={fast}
          muted={muted}
          onContinue={() => setMenuOpen(false)}
          onFast={onFast}
          onMute={onMute}
          onNewGame={onNewGame}
          onFit={() => view.camera?.fit()}
          onFocus={focusCurrent}
          onLanguage={onLanguage}
        />
      )}
      {result && (
        <WinDialog
          result={result}
          onPlayAgain={() =>
            onPlayAgain({
              level: result.state.level,
              playOn: false,
              players: result.state.players.map(({ hero, controller: who, name }) => ({
                hero,
                controller: who,
                name,
              })),
            })
          }
          onPlayOn={() => {
            hudStore.clearResult();
            void controller.current?.continuePlay();
          }}
          onMenu={() => {
            clearSave();
            onExit();
          }}
        />
      )}
    </main>
  );
}
