// Pure layout of the nine arched stone bridges (T44 6.2): where each deck runs, how high, how many arches, which
// blocks it crosses over. The Blender build (scripts/blender/bridges.py) reads the samples this module writes, so the
// GLB deck and the path a hero runs along are the same curve. Units: 1 u = one block pitch (boardLayout frame:
// x right, y up, z toward the viewer). No three, no React.

import { STORY_JUMPS } from '../../core/boards';
import { BLOCK_HALF, blockTopY, groundHeightAt, squareCentre } from './boardLayout';

/** Foot abutment: centred this far toward the back (-z) of the foot block; 0.25 wide x 0.21 deep. */
export const FOOT_BACK = 0.375;
/** Top abutment: centred this far toward the front (+z) of the top block's centre; 0.25 wide x 0.29 deep. */
export const TOP_SILL = 0.357;
export const ABUTMENT_H = 0.054;
/** Look pass: a hero's body is wider than spec 6.2's 0.25 deck, so the walkway is 0.30 wide between 0.04 parapets. */
export const DECK_WIDTH = 0.3;
export const PARAPET_WIDTH = 0.04;
export const ABUTMENT_WIDTH = 0.42;
export const FOOT_ABUTMENT_DEPTH = 0.21;
export const TOP_ABUTMENT_DEPTH = 0.29;
/** rama-setu and shiva-bow bow this far toward -z at mid-span. */
export const BOW = 0.21;
export const BOWED: ReadonlySet<string> = new Set(['rama-setu', 'shiva-bow']);
/**
 * The wedding hump takes the cap (0.39 u, spec 6.2's min()) instead of 0.125 + 0.08 L = 0.31: the spec asks for a
 * clearance of at least 0.125 u over kaikeyi's coil on 46, and the formula leaves 0.084 u (T42 6.5 assumed the deck
 * sits at its apex there; it crosses at s = 0.56).
 */
const HUMP_OVERRIDE: Readonly<Record<string, number>> = { wedding: 0.39 };
/** Deck samples per bridge; divisible by 1, 2, 3 and 4 so every pier falls on a sample. */
export const DECK_SAMPLES = 120;

export interface DeckPoint {
  /** Position of the walking surface on the route centre line. */
  x: number;
  y: number;
  z: number;
  /** Ground height under that point (block top, groove ramps included). */
  ground: number;
}

export interface BridgeLayout {
  id: string;
  from: number;
  to: number;
  /** Straight horizontal distance F -> T (L in spec 6.2). */
  length: number;
  /** Apex rise of the sine hump over the abutment line, u. */
  h: number;
  openings: number;
  bow: number;
  foot: readonly [number, number];
  top: readonly [number, number];
  /** Walking surface at the abutments (block top + 0.054). */
  baseFoot: number;
  baseTop: number;
}

export interface Bridge extends BridgeLayout {
  /** DECK_SAMPLES + 1 points from the foot abutment to the top abutment, uniform in the route parameter. */
  deck: readonly DeckPoint[];
  /** Arc length of the deck centre line, u. */
  deckLength: number;
  /** Squares whose block the deck centre line passes over (foot and top excluded; matches T42 6.2): the fade-when-behind set. */
  crossed: readonly number[];
}

/** The nine ladders (the story ids), by square pair. */
export const BRIDGE_PAIRS: readonly { id: string; from: number; to: number }[] = STORY_JUMPS.filter(
  (jump) => jump.kind === 'ladder',
).map(({ id, from, to }) => ({ id, from, to }));

export function bridgeLayout(id: string, from: number, to: number): BridgeLayout {
  const [fx, fz] = squareCentre(from);
  const [tx, tz] = squareCentre(to);
  const foot: [number, number] = [fx, fz - FOOT_BACK];
  const top: [number, number] = [tx, tz + TOP_SILL];
  const length = Math.hypot(top[0] - foot[0], top[1] - foot[1]);
  return {
    id,
    from,
    to,
    length,
    h: HUMP_OVERRIDE[id] ?? Math.min(0.39, 0.125 + 0.08 * length),
    openings: Math.max(1, Math.round(length / 0.8)),
    bow: BOWED.has(id) ? BOW : 0,
    foot,
    top,
    baseFoot: blockTopY(from) + ABUTMENT_H,
    baseTop: blockTopY(to) + ABUTMENT_H,
  };
}

/** Horizontal position of the route at parameter s (0 foot .. 1 top), bow included. */
export function routeAt(layout: BridgeLayout, s: number): [number, number] {
  const bow = layout.bow * Math.sin(Math.PI * s);
  return [
    layout.foot[0] + (layout.top[0] - layout.foot[0]) * s,
    layout.foot[1] + (layout.top[1] - layout.foot[1]) * s - bow,
  ];
}

/** Height of the walking surface at parameter s: abutment tops joined by a sine hump (spec 6.2). */
export function deckHeightAt(layout: BridgeLayout, s: number): number {
  return layout.baseFoot + (layout.baseTop - layout.baseFoot) * s + layout.h * Math.sin(Math.PI * s);
}

export function deckPointAt(layout: BridgeLayout, s: number): DeckPoint {
  const [x, z] = routeAt(layout, s);
  return { x, y: deckHeightAt(layout, s), z, ground: groundHeightAt(x, z) };
}

function squaresOverRibbon(deck: readonly DeckPoint[], layout: BridgeLayout): number[] {
  const hits = new Set<number>();
  for (let square = 1; square <= 144; square++) {
    if (square === layout.from || square === layout.to) continue;
    const [cx, cz] = squareCentre(square);
    const near = deck.some((p) => Math.abs(p.x - cx) < BLOCK_HALF && Math.abs(p.z - cz) < BLOCK_HALF);
    if (near) hits.add(square);
  }
  return [...hits].sort((a, b) => a - b);
}

export function buildBridge(id: string, from: number, to: number): Bridge {
  const layout = bridgeLayout(id, from, to);
  const deck = Array.from({ length: DECK_SAMPLES + 1 }, (_, i) => deckPointAt(layout, i / DECK_SAMPLES));
  let deckLength = 0;
  for (let i = 1; i < deck.length; i++) {
    const a = deck[i - 1]!;
    const b = deck[i]!;
    deckLength += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return { ...layout, deck, deckLength, crossed: squaresOverRibbon(deck, layout) };
}

let cache: Map<string, Bridge> | undefined;

/** Every bridge by story id (built once). */
export function bridges(): ReadonlyMap<string, Bridge> {
  cache ??= new Map(BRIDGE_PAIRS.map(({ id, from, to }) => [id, buildBridge(id, from, to)]));
  return cache;
}

export function bridgeById(id: string): Bridge | undefined {
  return bridges().get(id);
}
