// `window.__app`: the small, stable surface end-to-end scripts (smoke, devices, screenshots) drive the game through.

import type { GameEvent } from '../core/events';
import type { GameConfig, GameState } from '../core/types';
import type { TurnController } from './turn/TurnController';

export type ScreenName = 'boot' | 'setup' | 'game' | 'gallery';

export interface AppSnapshot {
  screen: ScreenName;
  /** The engine state of the game on screen, or null outside a game. */
  game: GameState | null;
  busy: boolean;
  fast: boolean;
  /** The Win screen is showing. */
  winShown: boolean;
  menuOpen: boolean;
  /** The portrait "rotate your device" prompt is showing. */
  rotatePrompt: boolean;
  lastEvent: GameEvent | null;
}

export interface AppHooks {
  /** True once the app has mounted its first screen. */
  readonly ready: boolean;
  /** True while a turn is animating or a bot is about to roll. */
  readonly isBusy: boolean;
  /** Starts a new game with this config from any screen; resolves once the board is up and the first turn began. */
  startGame(config: GameConfig): Promise<void>;
  /** Rolls for the human whose turn it is (a no-op on bot turns or while busy). */
  requestRoll(): Promise<void>;
  state(): AppSnapshot;
  setFast(on: boolean): void;
}

declare global {
  interface Window {
    __app?: AppHooks;
  }
}

/** What the React tree reports to the hooks; App and GameScreen keep it current. */
export const bridge = {
  ready: false,
  screen: 'boot' as ScreenName,
  controller: null as TurnController | null,
  winShown: false,
  menuOpen: false,
  rotatePrompt: false,
  /** Set by App: switches to the game screen with a new game. */
  openGame: null as ((config: GameConfig) => void) | null,
  /** Set by App: the Fast setting, kept across games. */
  setFast: null as ((on: boolean) => void) | null,
  waiters: [] as (() => void)[],
};

/** GameScreen calls this once its controller has started. */
export function controllerStarted(controller: TurnController): void {
  bridge.controller = controller;
  const waiters = bridge.waiters;
  bridge.waiters = [];
  waiters.forEach((resolve) => resolve());
}

export function installAppHooks(): void {
  window.__app = {
    get ready() {
      return bridge.ready;
    },
    get isBusy() {
      return bridge.controller?.isBusy ?? false;
    },
    startGame(config) {
      const open = bridge.openGame;
      if (!open) return Promise.reject(new Error('the app is not mounted'));
      return new Promise<void>((resolve) => {
        bridge.waiters.push(resolve);
        open(config);
      });
    },
    async requestRoll() {
      await bridge.controller?.requestRoll();
    },
    state() {
      const controller = bridge.screen === 'game' ? bridge.controller : null;
      return {
        screen: bridge.screen,
        game: controller?.snapshot() ?? null,
        busy: controller?.isBusy ?? false,
        fast: controller?.fast ?? false,
        winShown: bridge.winShown,
        menuOpen: bridge.menuOpen,
        rotatePrompt: bridge.rotatePrompt,
        lastEvent: controller?.lastEvent ?? null,
      };
    },
    setFast(on) {
      bridge.setFast?.(on);
    },
  };
}
