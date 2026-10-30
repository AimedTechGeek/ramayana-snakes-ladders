// Typed manifest of the vector art under public/assets. URLs are relative so the GitHub Pages sub-path works.
import ladderPalette from '../../public/assets/ladders/palette.json';
import snakePalette from '../../public/assets/snakes/palette.json';
import type { Emotion } from '../characters/reactions';
import type { Hero, Level } from '../core/types';
import figurineManifest from '../../public/assets/iso/figurines.json';

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

// ---- Isometric art (T40): the board per difficulty (SVG, rasterised at 2x) and the figurine PNGs (already 2x).

export const BOARD_STAGE = { width: 784, height: 720, scale: 2 } as const;

export function boardKey(level: Level): string {
  return `board-${level}`;
}

export function boardUrl(level: Level): string {
  return `assets/iso/board-${level}.svg`;
}

/** Heroes whose token and seat figure are an iso figurine; the others keep the old medallion until T40.10. */
export const FIGURINE_HEROES: readonly Hero[] = ['hanuman'];

export type FigurineSize = 's' | 'm' | 'l';

export interface FigurineFrame {
  /** Texture size in pixels (the PNG is `scale` x its display size). */
  w: number;
  h: number;
  /** The feet point in texture pixels. */
  anchorX: number;
  anchorY: number;
  scale: number;
}

const FIGURINE_FRAMES = figurineManifest as Record<string, FigurineFrame>;

export function figurineKey(hero: Hero, emotion: Emotion, lit: boolean, size: FigurineSize): string {
  return `fig-${hero}-${emotion}${lit ? '-lit' : ''}-${size}`;
}

export function figurineFrame(hero: Hero, emotion: Emotion, lit: boolean, size: FigurineSize): FigurineFrame {
  const frame = FIGURINE_FRAMES[`${hero}.${emotion}.${lit ? 'lit' : 'plain'}.${size}`];
  if (!frame) throw new Error(`No figurine frame for ${hero} ${emotion} ${lit ? 'lit' : 'plain'} ${size}`);
  return frame;
}

export const EMOTIONS: readonly Emotion[] = ['idle', 'happy', 'excited', 'scared', 'sad'];

/** Every emotion, plain and lit, of the given heroes at the given sizes. */
export function figurineAssets(
  heroes: readonly Hero[],
  sizes: readonly FigurineSize[],
): { key: string; url: string }[] {
  return heroes
    .filter((hero) => FIGURINE_HEROES.includes(hero))
    .flatMap((hero) =>
      sizes.flatMap((size) =>
        EMOTIONS.flatMap((emotion) =>
          [false, true].map((lit) => ({
            key: figurineKey(hero, emotion, lit, size),
            url: `assets/iso/fig/${hero}-${emotion}${lit ? '-lit' : ''}-${size}.png`,
          })),
        ),
      ),
    );
}
