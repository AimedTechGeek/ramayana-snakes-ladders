import type Phaser from 'phaser';
import type { Hero } from '../core/types';
import { COLORS } from '../game/palette';
import type { Emotion } from './reactions';

const SITA_ROSE = 0xd15587;

/** Draws one of the five expressions from T02 section 4 into a 100x100 face box centred on (0,0). */
export function drawFace(g: Phaser.GameObjects.Graphics, hero: Hero, emotion: Emotion, radius: number): void {
  const s = radius / 42;
  const X = (x: number) => (x - 50) * s;
  const Y = (y: number) => (y - 50) * s;
  const dignified = hero === 'rama' || hero === 'sita';
  g.clear();

  const eyes: [number, number][] = [
    [36, 46],
    [64, 46],
  ];
  // Eye whites and pupils.
  for (const [ex, ey] of eyes) {
    g.fillStyle(COLORS.parchment, 1);
    g.lineStyle(Math.max(1, 2 * s), COLORS.ink, 1);
    if (emotion === 'excited' || emotion === 'scared') {
      const r = emotion === 'excited' ? 8 : 9;
      g.fillCircle(X(ex), Y(ey - (emotion === 'excited' ? 2 : 1)), r * s);
      g.strokeCircle(X(ex), Y(ey - (emotion === 'excited' ? 2 : 1)), r * s);
    } else {
      const h = emotion === 'idle' ? 11 : 9;
      g.fillEllipse(X(ex), Y(ey + (emotion === 'sad' ? 1 : 0)), 16 * s, h * s);
      g.strokeEllipse(X(ex), Y(ey + (emotion === 'sad' ? 1 : 0)), 16 * s, h * s);
    }
    const pupil = { idle: 4, happy: 4, excited: 5, scared: 3, sad: 4 }[emotion];
    const shiftX = emotion === 'scared' ? (ex < 50 ? -2 : -2) : 0;
    const shiftY = { idle: 0, happy: -1, excited: -2, scared: -1, sad: 1 }[emotion];
    g.fillStyle(COLORS.ink, 1);
    g.fillCircle(X(ex + shiftX), Y(ey + shiftY), pupil * s);
    if (emotion !== 'scared') {
      g.fillStyle(COLORS.parchment, 1);
      g.fillCircle(X(ex + shiftX - 1.5), Y(ey + shiftY - 1.5), (emotion === 'excited' ? 2 : 1.5) * s);
    }
  }

  // Brows: [x1, y1, x2, y2] for left and right.
  const brows: Record<Emotion, [number, number, number, number][]> = {
    idle: [
      [26, 34, 46, 32],
      [54, 32, 74, 34],
    ],
    happy: [
      [26, 32, 46, 30],
      [54, 30, 74, 32],
    ],
    excited: [
      [26, 27, 46, 29],
      [54, 29, 74, 27],
    ],
    scared: dignified
      ? [
          [26, 34, 46, 32],
          [54, 32, 74, 34],
        ]
      : [
          [26, 36, 46, 30],
          [54, 30, 74, 36],
        ],
    sad: [
      [26, 34, 46, 30],
      [54, 30, 74, 34],
    ],
  };
  g.lineStyle(Math.max(1.5, 4 * s), COLORS.ink, 1);
  for (const [x1, y1, x2, y2] of brows[emotion]) g.lineBetween(X(x1), Y(y1), X(x2), Y(y2));

  // Mouth.
  const wide = hero === 'hanuman' ? 6 : 0;
  g.lineStyle(Math.max(1.2, 3 * s), COLORS.ink, 1);
  if (emotion === 'idle') curve(g, X(38 - wide), Y(66), X(62 + wide), Y(66), 3 * s);
  if (emotion === 'happy') curve(g, X(32 - wide), Y(64), X(68 + wide), Y(64), 10 * s);
  if (emotion === 'sad') curve(g, X(40 - wide), Y(68), X(60 + wide), Y(68), -3 * s);
  if (emotion === 'excited') {
    g.fillStyle(COLORS.blood, 1);
    g.beginPath();
    g.moveTo(X(32 - wide), Y(62));
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const x = X(32 - wide) + (X(68 + wide) - X(32 - wide)) * t;
      g.lineTo(x, Y(62) + Math.sin(Math.PI * t) * 12 * s);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(COLORS.parchment, 1);
    g.fillRect(X(38 - wide), Y(62), (24 + 2 * wide) * s, 4 * s);
  }
  if (emotion === 'scared') {
    g.fillStyle(COLORS.blood, 1);
    g.fillEllipse(X(50), Y(68), 10 * s, 8 * s);
    g.strokeEllipse(X(50), Y(68), 10 * s, 8 * s);
  }

  // Cheeks and the comic extras (never for Rama or Sita).
  if (emotion === 'happy' || emotion === 'excited') {
    g.fillStyle(SITA_ROSE, emotion === 'happy' ? 0.6 : 0.8);
    g.fillEllipse(X(28), Y(58), 6 * s, 4 * s);
    g.fillEllipse(X(72), Y(58), 6 * s, 4 * s);
  }
  if (dignified) return;
  if (emotion === 'excited') {
    g.lineStyle(Math.max(1, 2.5 * s), COLORS.gold, 1);
    sparkle(g, X(4), Y(22), 6 * s);
    sparkle(g, X(96), Y(18), 5 * s);
  }
  if (emotion === 'scared') {
    g.lineStyle(Math.max(1, 2.5 * s), COLORS.ink, 1);
    for (const dx of [0, 6, 12]) g.lineBetween(X(76 + dx), Y(20 + dx / 2), X(78 + dx), Y(28 + dx / 2));
  }
  if (emotion === 'sad') {
    g.fillStyle(COLORS.river, 1);
    g.fillCircle(X(34), Y(56), 2 * s);
  }
}

function curve(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bulge: number,
): void {
  g.beginPath();
  g.moveTo(x1, y1);
  for (let t = 0.1; t <= 1.0001; t += 0.1)
    g.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * bulge);
  g.strokePath();
}

function sparkle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.lineBetween(x - r, y, x + r, y);
  g.lineBetween(x, y - r, x, y + r);
}
