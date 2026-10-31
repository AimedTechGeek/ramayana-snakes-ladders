// Typed manifest of the vector art under public/assets. URLs are relative so the GitHub Pages sub-path works.
import type Phaser from 'phaser';
import type { Emotion } from '../characters/reactions';
import type { Hero } from '../core/types';
import figurineManifest from '../../public/assets/iso/figurines.json';

export interface SvgAsset {
  key: string;
  url: string;
  /** Pixel size the SVG is rasterised at (larger than its display size so it stays crisp). */
  size: number;
}

export const HERO_IDS: readonly Hero[] = ['rama', 'sita', 'lakshmana', 'hanuman'];

export function tokenKey(hero: Hero): string {
  return `token-${hero}`;
}

export const FAVICON_URL = 'assets/icons/favicon.svg';

export const ASSETS: readonly SvgAsset[] = [
  ...HERO_IDS.map((hero) => ({ key: tokenKey(hero), url: `assets/tokens/${hero}.svg`, size: 80 })),
  { key: 'favicon', url: FAVICON_URL, size: 64 },
];

// ---- Isometric art (T40): the figurine PNGs (already 2x).

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

// ---- Texture atlases (T42.1): sheets built by scripts/art/iso/atlas.mjs into public/assets/iso/<sheet>.{png,json,meta.json}.

/** Per-frame sidecar entry: sizes and the anchor are in frame (device) pixels; extra art-task meta rides along. */
export interface AtlasFrameMeta {
  w: number;
  h: number;
  /** Device px per logical px the frame was rasterised at; draw the sprite at scale 1 / factor. */
  factor: number;
  anchorX: number;
  anchorY: number;
  [extra: string]: unknown;
}

export interface AtlasMeta {
  sheet: string;
  width: number;
  height: number;
  padding: number;
  frames: Record<string, AtlasFrameMeta>;
}

export interface AtlasSheet {
  /** Phaser texture key; the sidecar is cached as json under `atlasMetaKey(key)`. */
  key: string;
  png: string;
  json: string;
  meta: string;
}

export function atlasMetaKey(key: string): string {
  return `${key}-meta`;
}

/** URLs of a built sheet; `base` defaults to the shared iso folder. */
export function atlasSheet(name: string, base = 'assets/iso'): AtlasSheet {
  return {
    key: name,
    png: `${base}/${name}.png`,
    json: `${base}/${name}.json`,
    meta: `${base}/${name}.meta.json`,
  };
}

/** Hanuman's walking figure (T43): every clip, facing and rest pose; loaded by BoardScene when he is seated. */
export const HANUMAN_SHEET = 'hanuman-s';
export const SHARED_SHEET = 'shared';

/**
 * Sheets every scene loads. Art tasks append theirs here (T42.2 `blocks`, `shared`; T42.3 `props`; T42.4 `frame`);
 * level-specific `snakes-<level>` and `bridges-<level>` are loaded per level with `loadAtlas`.
 */
export const ATLAS_SHEETS: readonly AtlasSheet[] = ['blocks', 'shared', 'props', 'frame'].map((name) =>
  atlasSheet(name),
);

/** Queues a sheet (image, Phaser atlas data and sidecar) on the scene's loader; call from preload(). */
export function loadAtlas(scene: Phaser.Scene, sheet: AtlasSheet): void {
  scene.load.atlas(sheet.key, sheet.png, sheet.json);
  scene.load.json(atlasMetaKey(sheet.key), sheet.meta);
}

/** The sidecar of a loaded sheet. */
export function atlasMeta(scene: Phaser.Scene, key: string): AtlasMeta {
  const meta = scene.cache.json.get(atlasMetaKey(key)) as AtlasMeta | undefined;
  if (!meta) throw new Error(`Atlas ${key} has no loaded meta`);
  return meta;
}

/** One frame's sidecar entry; throws for an unknown frame so a typo fails loudly. */
export function atlasFrameMeta(scene: Phaser.Scene, key: string, frame: string): AtlasFrameMeta {
  const entry = atlasMeta(scene, key).frames[frame];
  if (!entry) throw new Error(`Atlas ${key} has no frame ${frame}`);
  return entry;
}

/** The anchor (world point of the object) in frame pixels. */
export function atlasAnchor(meta: AtlasFrameMeta): { x: number; y: number } {
  return { x: meta.anchorX, y: meta.anchorY };
}

/** The anchor as a Phaser origin (0..1): `sprite.setOrigin(origin.x, origin.y).setScale(1 / meta.factor)`. */
export function atlasOrigin(meta: AtlasFrameMeta): { x: number; y: number } {
  return { x: meta.anchorX / meta.w, y: meta.anchorY / meta.h };
}

/**
 * A sprite of an atlas frame placed so its anchor sits at (x, y) in the container's logical px, drawn at 1 / factor
 * (the board camera supplies the DPR and zoom).
 */
export function addAtlasSprite(
  scene: Phaser.Scene,
  key: string,
  frame: string,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  const meta = atlasFrameMeta(scene, key, frame);
  const origin = atlasOrigin(meta);
  return scene.add
    .image(x, y, key, frame)
    .setOrigin(origin.x, origin.y)
    .setScale(1 / meta.factor);
}
