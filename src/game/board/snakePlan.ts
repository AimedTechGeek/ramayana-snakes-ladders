// Pure planning for the standing snake (T42.8): the bite timeline of spec 5.4 and the head geometry of spec 5.2 / 5.3.
// No Phaser, so the timings and the placement maths are unit-tested.

/** Spec 5.4 durations, [normal, fast] in ms. The rise happens on a snake's first reveal only. */
const STEP_MS = {
  rise: [380, 120],
  hold: [260, 0],
  strike: [180, 90],
  swallow: [320, 150],
  pan: [420, 0],
  restore: [220, 0],
  reappear: [260, 120],
} as const;

export type SnakeStepName = keyof typeof STEP_MS;

export interface StepSpan {
  start: number;
  end: number;
}

export interface SnakeTimeline {
  steps: Record<SnakeStepName, StepSpan>;
  /** Rise start to reappear end: what the player waits for. */
  total: number;
  /** The token is inside the snake: from the start of the swallow to the start of the reappearance (steps 4 to 7). */
  tokenInSnake: StepSpan;
  /** The token is fully invisible: from the end of the swallow to the start of the reappearance. */
  tokenInvisible: StepSpan;
}

/**
 * Step times of one bite, in ms from the first frame of the sequence. `firstReveal` false (a snake that was already
 * standing) skips the rise. The head restore runs beside the camera pan, so it is not part of `total`.
 */
export function snakeTimeline(fast: boolean, firstReveal = true): SnakeTimeline {
  const length = (name: SnakeStepName): number =>
    name === 'rise' && !firstReveal ? 0 : STEP_MS[name][fast ? 1 : 0];
  let clock = 0;
  const next = (name: SnakeStepName): StepSpan => {
    const span = { start: clock, end: clock + length(name) };
    clock = span.end;
    return span;
  };
  const rise = next('rise');
  const hold = next('hold');
  const strike = next('strike');
  const swallow = next('swallow');
  const restore = { start: swallow.end, end: swallow.end + length('restore') };
  const pan = next('pan');
  const reappear = next('reappear');
  return {
    steps: { rise, hold, strike, swallow, pan, restore, reappear },
    total: reappear.end,
    tokenInSnake: { start: swallow.start, end: reappear.start },
    tokenInvisible: { start: swallow.end, end: reappear.start },
  };
}

// ---------------------------------------------------------------- manifest

export interface SnakeSheetEntry {
  coil: { frame: string; anchor: [number, number] };
  head: {
    closed: string;
    open: string;
    pivot: [number, number];
    mouth: [number, number];
    neck: [number, number][];
  };
  body: string;
  R: number;
  headTop: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** The sheet's `snakes[id]` entry; throws for an unknown id so a typo fails loudly. */
export function snakeEntry(meta: { snakes?: Record<string, SnakeSheetEntry> }, id: string): SnakeSheetEntry {
  const entry = meta.snakes?.[id];
  if (!entry) throw new Error(`Snake sheet has no snake ${id}`);
  return entry;
}

/** Device px (factor 5) to logical px. */
export function toLogical(point: readonly [number, number], factor: number): Pt {
  return { x: point[0] / factor, y: point[1] / factor };
}

/** The coil stands 14 units behind the tile centre (spec 5.2), i.e. 5 behind FIELD_C, the token landing point. */
export const COIL_BEHIND_FIELD_UNITS = 5;

// ---------------------------------------------------------------- head geometry

/** Mirrors a head-relative point when the head is turned to face left. */
export function mirrored(point: Pt, side: number): Pt {
  return { x: point.x * side, y: point.y };
}

/** Rotates a point about the origin by degrees (screen space, clockwise positive like Phaser). */
export function rotated(point: Pt, degrees: number): Pt {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

/** The head faces right as drawn; it turns to face left only when the token is clearly left of the pivot. */
export function headSide(pivot: Pt, token: Pt): 1 | -1 {
  return token.x < pivot.x - 4 ? -1 : 1;
}

/** Largest tasteful turn of the head toward the token, in degrees. */
export const MAX_TURN_DEG = 14;

/** The turn (degrees, about the pivot, clockwise positive) that points the mouth at the token's body, clamped. */
export function headTurn(pivot: Pt, mouth: Pt, side: number, token: Pt): number {
  const toDegrees = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
  const wanted = toDegrees(token.x - pivot.x, token.y - pivot.y);
  const drawn = toDegrees(mouth.x * side, mouth.y);
  let turn = wanted - drawn;
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  return Math.max(-MAX_TURN_DEG, Math.min(MAX_TURN_DEG, turn));
}

/** A head-relative point in screen space once the head is placed, mirrored, rotated and shifted. */
export function headPoint(
  pivot: Pt,
  local: Pt,
  side: number,
  degrees: number,
  shift: Pt = { x: 0, y: 0 },
): Pt {
  const r = rotated(mirrored(local, side), degrees);
  return { x: pivot.x + shift.x + r.x, y: pivot.y + shift.y + r.y };
}

/** Blends two 0xRRGGBB colours: `amount` 0 gives a, 1 gives b (tongue and bulge tints). */
export function blendColor(a: number, b: number, amount: number): number {
  const ch = (shift: number) =>
    Math.round(((a >> shift) & 0xff) * (1 - amount) + ((b >> shift) & 0xff) * amount);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
