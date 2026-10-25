// Typed manifest of the vector art under public/assets. URLs are relative so the GitHub Pages sub-path works.
import ladderPalette from '../../public/assets/ladders/palette.json';
import snakePalette from '../../public/assets/snakes/palette.json';
import type { Hero } from '../core/types';

export interface SvgAsset {
  key: string;
  url: string;
  /** Pixel size the SVG is rasterised at (larger than its display size so it stays crisp). */
  size: number;
}

export type SnakePattern = 'bands' | 'spots' | 'diamonds';
export type LadderStyle = 'wood' | 'rope' | 'vine' | 'stone' | 'bow' | 'tail';

export interface SnakeLook {
  body: string;
  belly: string;
  pattern: SnakePattern;
}

export interface LadderLook {
  rail: string;
  rung: string;
  style: LadderStyle;
}

export const SNAKE_LOOKS: Readonly<Record<string, SnakeLook>> = snakePalette as Record<string, SnakeLook>;
export const LADDER_LOOKS: Readonly<Record<string, LadderLook>> = ladderPalette as Record<string, LadderLook>;

export const BOARD_BACKGROUND_KEY = 'board-background';

export const HERO_IDS: readonly Hero[] = ['rama', 'sita', 'lakshmana', 'hanuman'];

export function tokenKey(hero: Hero): string {
  return `token-${hero}`;
}

export function snakeHeadKey(id: string): string {
  return `snake-head-${id}`;
}

export const FAVICON_URL = 'assets/icons/favicon.svg';

export const ASSETS: readonly SvgAsset[] = [
  { key: BOARD_BACKGROUND_KEY, url: 'assets/board/background.svg', size: 672 },
  ...HERO_IDS.map((hero) => ({ key: tokenKey(hero), url: `assets/tokens/${hero}.svg`, size: 80 })),
  ...Object.keys(SNAKE_LOOKS).map((id) => ({
    key: snakeHeadKey(id),
    url: `assets/snakes/${id}.svg`,
    size: 96,
  })),
  { key: 'favicon', url: FAVICON_URL, size: 64 },
];
