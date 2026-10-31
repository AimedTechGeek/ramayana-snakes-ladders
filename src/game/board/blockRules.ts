// Pure rules of the living board's blocks (T42 spec 1.3, 1.5, 2): region, pattern and prop choice per square.
// TS twin of scripts/art/iso/blocks.mjs (seedOf, patternOf, propCountOf, regionOf, frameNameOf, REGIONS); a test
// proves the two agree for all 144 squares. No Phaser.

import { gridOf } from '../layout';

export type RegionName = 'mithila' | 'ayodhya' | 'dandaka' | 'ganga' | 'kishkindha' | 'sea' | 'lanka';
export type NumeralInk = 'dark' | 'bone';

export const FINAL_SQUARE = 144;
export const GANGA_SQUARES: readonly number[] = [49, 50, 71, 72, 73, 74];

/** Numeral ink of a revealed block per region (spec 2); a fogged block always shows `dark`. */
export const REGION_INK: Readonly<Record<RegionName, NumeralInk>> = {
  mithila: 'dark',
  ayodhya: 'dark',
  dandaka: 'dark',
  ganga: 'bone',
  kishkindha: 'dark',
  sea: 'bone',
  lanka: 'bone',
};

/** Knuth hash of the square number: the only seed of the variety rule (identical on every level). */
export function seedOf(square: number): number {
  return (square * 2654435761) >>> 0;
}

export function patternOf(square: number): 'a' | 'b' {
  return seedOf(square) & 1 ? 'b' : 'a';
}

export function propCountOf(square: number): 1 | 2 {
  return (1 + ((seedOf(square) >>> 1) & 1)) as 1 | 2;
}

export function regionOf(square: number): RegionName {
  if (!Number.isInteger(square) || square < 1 || square > FINAL_SQUARE)
    throw new Error(`square out of range: ${square}`);
  if (GANGA_SQUARES.includes(square)) return 'ganga';
  if (square <= 36) return 'mithila';
  if (square <= 48) return 'ayodhya';
  if (square <= 84) return 'dandaka';
  if (square <= 108) return 'kishkindha';
  if (square <= 120) return 'sea';
  return 'lanka';
}

/** Atlas frame (sheet `blocks`) of a square's base tile; Ganga has one pattern. */
export function frameNameOf(square: number): string {
  const region = regionOf(square);
  return region === 'ganga' ? 'ganga' : `${region}-${patternOf(square)}`;
}

/** Fog frame (sheet `blocks`) of a square: one per region. */
export function fogFrameOf(square: number): string {
  return `${regionOf(square)}-fog`;
}

const ODD_TILE = 0xf0;
const DANDAKA_ROW_TINT: Readonly<Record<number, number>> = { 5: 0xff, 6: 0xeb, 7: 0xd8 };

/**
 * Tint multiplier of a base tile: odd (row + column) squares are 6 % darker (0xF0F0F0) and Dandaka rows deepen
 * (row 5 0xFFFFFF, row 6 0xEBEBEB, row 7 0xD8D8D8); the two multiply. Row and column parity is the same 0- or 1-based.
 */
export function tileTintOf(square: number): number {
  const { row, column } = gridOf(square);
  const rowTint = regionOf(square) === 'dandaka' ? (DANDAKA_ROW_TINT[row + 1] ?? 0xff) : 0xff;
  const parity = (row + column) % 2 === 1 ? ODD_TILE : 0xff;
  const channel = Math.round((rowTint * parity) / 0xff);
  return (channel << 16) | (channel << 8) | channel;
}

// ---------------------------------------------------------------- props (spec 1.3 and 1.5)

/** The part of a props-atlas meta entry the placement rule reads. */
export interface PropKind {
  kind: string;
  regions: readonly string[];
  zone: 'side' | 'back' | 'centre';
  height: number;
  anim: 'sway' | 'flicker' | 'smoke' | 'shimmer' | 'none';
  variety: boolean;
  squares?: readonly number[];
}

/** A prop standing on a block: offset in world units from the tile centre (x right, y toward the viewer). */
export interface PlacedProp {
  kind: string;
  x: number;
  y: number;
}

/** Strip centres in world units from the tile centre (spec 1.3: side strips x 17..27, y -28..+10; back strip y -28..-22). */
export const STRIP = { sideX: 22, sideY: -9, backY: -25 } as const;
/** A back-strip prop is at most this tall (spec 1.3); taller random kinds take a side strip. */
export const BACK_MAX_HEIGHT = 12;

/** The region's random list, in atlas order: kinds flagged `variety` that the region uses. */
export function randomKindsOf(region: RegionName, catalog: readonly PropKind[]): PropKind[] {
  return catalog.filter((kind) => kind.variety && kind.regions.includes(region));
}

function sideSpot(left: boolean, jitter: number): { x: number; y: number } {
  return { x: left ? -STRIP.sideX : STRIP.sideX, y: STRIP.sideY + jitter };
}

/**
 * Props of every square 1..144 (index = square; index 0 is empty). Rule per spec 1.3, deterministic from the square
 * number only: first random kind `list[(seed >>> 2) % n]` (the next kind if it equals the previous square's first kind)
 * on the left side strip when `(seed >>> 17) & 1`, else the right; second kind `list-without-first[(seed >>> 8) % (n-1)]`
 * on the back strip when it is at most 12 tall, otherwise on the other side strip; jitter `((seed >>> 20) % 7) - 3`
 * units along the strip. Landmark squares add their fixed kinds (zone from the meta: side opposite the first prop,
 * back, centre) and drop the random second.
 */
export function layoutProps(catalog: readonly PropKind[]): PlacedProp[][] {
  const out: PlacedProp[][] = [[]];
  let previousFirst: string | undefined;
  for (let square = 1; square <= FINAL_SQUARE; square++) {
    const list = randomKindsOf(regionOf(square), catalog);
    const fixed = catalog.filter((kind) => kind.squares?.includes(square));
    const seed = seedOf(square);
    const jitter = ((seed >>> 20) % 7) - 3;
    const placed: PlacedProp[] = [];
    let index = (seed >>> 2) % list.length;
    if (list[index]?.kind === previousFirst) index = (index + 1) % list.length;
    const first = list[index];
    if (first) {
      const left = ((seed >>> 17) & 1) === 1;
      placed.push({ kind: first.kind, ...sideSpot(left, jitter) });
      if (fixed.length === 0 && propCountOf(square) === 2 && list.length > 1) {
        const rest = list.filter((_, i) => i !== index);
        const second = rest[(seed >>> 8) % rest.length];
        if (second) {
          if (second.height <= BACK_MAX_HEIGHT) placed.push({ kind: second.kind, x: jitter, y: STRIP.backY });
          else placed.push({ kind: second.kind, ...sideSpot(!left, jitter) });
        }
      }
      for (const kind of fixed) {
        if (placed.some((p) => p.kind === kind.kind)) continue;
        if (kind.zone === 'centre') placed.push({ kind: kind.kind, x: 0, y: 0 });
        else if (kind.zone === 'back') placed.push({ kind: kind.kind, x: 0, y: STRIP.backY });
        else placed.push({ kind: kind.kind, ...sideSpot(!left, 0) });
      }
    }
    out.push(placed);
    previousFirst = first?.kind;
  }
  return out;
}
