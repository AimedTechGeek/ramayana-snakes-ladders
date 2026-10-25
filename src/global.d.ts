import type Phaser from 'phaser';

declare global {
  interface Window {
    __game?: Phaser.Game;
  }
}

export {};
