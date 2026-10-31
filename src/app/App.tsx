// Screen flow: Boot -> Setup -> Game (Menu and Win are dialogs over it) -> Boot; Gallery from Boot or #gallery.
// The Rotate prompt covers everything while the window is portrait.

import { useCallback, useEffect, useState } from 'react';
import type { GameConfig } from '../core/types';
import { getAudio } from '../game/audio';
import { loadGame, type LoadedGame } from '../game/save';
import { getLocale, setLocale } from '../i18n/i18n';
import { bridge, type ScreenName } from './appHooks';
import { BootScreen } from './screens/BootScreen';
import { RotatePrompt } from './screens/Dialogs';
import { GalleryScreen } from './screens/GalleryScreen';
import { GameScreen } from './screens/GameScreen';
import { SetupScreen } from './screens/SetupScreen';
import type { TurnStart } from './turn/TurnController';

function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(isPortrait);
  useEffect(() => {
    const update = () => setPortrait(isPortrait());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return portrait;
}

export function App() {
  const [screen, setScreen] = useState<ScreenName>(() => (location.hash === '#gallery' ? 'gallery' : 'boot'));
  /** A new id per game, so GameScreen remounts (Play Again starts afresh). */
  const [game, setGame] = useState<{ id: number; start: TurnStart } | null>(null);
  const [saved, setSaved] = useState<LoadedGame | null>(loadGame);
  const [, setLanguage] = useState(getLocale);
  const [fast, setFast] = useState(false);
  const [muted, setMuted] = useState(false);
  const portrait = usePortrait();

  const openGame = useCallback((next: TurnStart) => {
    setGame((previous) => ({ id: (previous?.id ?? 0) + 1, start: next }));
    setScreen('game');
  }, []);
  const toBoot = useCallback(() => {
    setGame(null);
    setSaved(loadGame());
    setScreen('boot');
  }, []);
  const toggleFast = useCallback(() => setFast((on) => !on), []);
  const toggleMute = useCallback(() => setMuted((on) => !on), []);

  useEffect(() => {
    bridge.screen = screen;
    bridge.rotatePrompt = portrait;
    bridge.openGame = (config: GameConfig) => openGame({ config });
    bridge.setFast = setFast;
    bridge.ready = true;
  }, [screen, portrait, openGame]);

  // Browsers keep audio locked until a gesture.
  useEffect(() => {
    const unlock = () => getAudio().unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <>
      {screen === 'boot' && (
        <BootScreen
          saved={saved}
          onPlay={() => setScreen('setup')}
          onResume={(game) => openGame({ state: game.state, reveal: game.reveal })}
          onToggleLanguage={() => {
            const next = getLocale() === 'en' ? 'hi' : 'en';
            setLocale(next);
            setLanguage(next);
          }}
          onGallery={() => setScreen('gallery')}
        />
      )}
      {screen === 'setup' && <SetupScreen onStart={(config) => openGame({ config })} onBack={toBoot} />}
      {screen === 'gallery' && <GalleryScreen onBack={toBoot} />}
      {screen === 'game' && game && (
        <GameScreen
          key={game.id}
          start={game.start}
          fast={fast}
          muted={muted}
          portrait={portrait}
          onFast={toggleFast}
          onMute={toggleMute}
          onExit={toBoot}
          onPlayAgain={(config) => openGame({ config })}
        />
      )}
      {portrait && <RotatePrompt />}
    </>
  );
}
