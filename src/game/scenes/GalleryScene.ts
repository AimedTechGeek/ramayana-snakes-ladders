import Phaser from 'phaser';
import { applyHiDpi } from '../hidpi';
import { Character } from '../../characters/Character';
import type { Emotion, TweenName } from '../../characters/reactions';
import { HERO_ORDER, HEROES, heroName } from '../heroes';
import { CSS, TITLE_FONT } from '../palette';

const EMOTIONS: readonly Emotion[] = ['idle', 'happy', 'excited', 'scared', 'sad'];
const TWEENS: readonly TweenName[] = [
  'none',
  'bounce',
  'leap',
  'somersault',
  'cower',
  'shake',
  'slump',
  'nod',
  'clap',
  'stomp',
  'fidget',
  'bless',
  'salute',
  'sigh',
];

/** Every hero in every expression; open the game with #gallery. Used for art review and the user guide. */
export class GalleryScene extends Phaser.Scene {
  private figures: Character[] = [];

  constructor() {
    super('Gallery');
  }

  create(): void {
    applyHiDpi(this);
    this.add
      .text(640, 36, 'Heroes and their emotions', {
        fontFamily: TITLE_FONT,
        fontSize: '34px',
        color: CSS.gold,
      })
      .setOrigin(0.5);
    EMOTIONS.forEach((emotion, col) =>
      this.add
        .text(300 + col * 200, 84, emotion, {
          fontFamily: TITLE_FONT,
          fontSize: '22px',
          color: CSS.parchment,
        })
        .setOrigin(0.5),
    );
    HERO_ORDER.forEach((hero, row) => {
      const y = 250 + row * 150;
      this.add
        .text(60, y - 50, heroName(hero), {
          fontFamily: TITLE_FONT,
          fontSize: '24px',
          color: HEROES[hero].cssColor,
        })
        .setOrigin(0, 0.5);
      EMOTIONS.forEach((emotion, col) => {
        const figure = new Character(this, 300 + col * 200, y, hero).setScale(1.25);
        figure.setEmotion(emotion);
        this.figures.push(figure);
      });
    });
    this.game.registry.set('gallery', this);
    this.game.registry.set('ready', true);
  }

  /** Plays every tween of the catalogue once on every figure; resolves when all have finished. */
  async playAll(): Promise<void> {
    for (const tween of TWEENS) {
      await Promise.all(
        this.figures.map((f) => f.feel({ emotion: 'excited', intensity: 1, tween, durationMs: 300 }, true)),
      );
    }
    this.figures.forEach((f, i) => {
      f.interrupt();
      f.setEmotion(EMOTIONS[i % EMOTIONS.length] ?? 'idle');
    });
  }
}
