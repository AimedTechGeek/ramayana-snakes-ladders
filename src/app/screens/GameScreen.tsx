// The game: the 3D board, the HUD over it, the pause menu and the Win dialog, around one TurnController.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameConfig } from '../../core/types';
import { getAudio } from '../../game/audio';
import { clearSave } from '../../game/save';
import { bridge, controllerStarted } from '../appHooks';
import { BoardCanvas } from '../board3d/BoardCanvas';
import { DioramaView } from '../board3d/DioramaView';
import { Hud } from '../hud/Hud';
import { HudStore } from '../hud/HudStore';
import { TurnController, type TurnStart } from '../turn/TurnController';
import { MenuDialog, WinDialog } from './Dialogs';

interface GameScreenProps {
  start: TurnStart;
  fast: boolean;
  muted: boolean;
  /** The portrait prompt is up: hold the game. */
  portrait: boolean;
  onFast: () => void;
  onMute: () => void;
  onExit: () => void;
  onPlayAgain: (config: GameConfig) => void;
}

export function GameScreen({
  start,
  fast,
  muted,
  portrait,
  onFast,
  onMute,
  onExit,
  onPlayAgain,
}: GameScreenProps) {
  const [view] = useState(() => new DioramaView(getAudio()));
  const [hudStore] = useState(() => new HudStore());
  const controller = useRef<TurnController | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hud = useSyncExternalStore(hudStore.subscribe, hudStore.getSnapshot);
  useSyncExternalStore(view.subscribe, view.getVersion);

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

  useEffect(
    () => () => {
      view.dispose();
      hudStore.dispose();
    },
    [view, hudStore],
  );
  useEffect(() => controller.current?.setFast(fast), [fast]);
  useEffect(() => controller.current?.setMuted(muted), [muted]);
  useEffect(() => controller.current?.setPaused(menuOpen || portrait), [menuOpen, portrait]);
  useEffect(() => {
    bridge.menuOpen = menuOpen;
    bridge.winShown = hud.result !== null;
  }, [menuOpen, hud.result]);

  const roll = () => void controller.current?.requestRoll();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return;
      getAudio().unlock();
      if (event.key === ' ' || event.key === 'Enter') {
        if (menuOpen || hud.result) return;
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
  return (
    <main className="screen game" data-testid="game">
      <BoardCanvas view={view} onBoardTap={roll} />
      <Hud
        hud={hud}
        view={view}
        onRoll={roll}
        onFast={onFast}
        onMute={onMute}
        onMenu={() => setMenuOpen(true)}
        onFit={() => view.camera?.fit()}
        onFocus={() => view.camera?.focus(Math.max(0, hud.current))}
      />
      {menuOpen && (
        <MenuDialog
          fast={fast}
          muted={muted}
          onContinue={() => setMenuOpen(false)}
          onFast={onFast}
          onMute={onMute}
          onMainMenu={onExit}
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
