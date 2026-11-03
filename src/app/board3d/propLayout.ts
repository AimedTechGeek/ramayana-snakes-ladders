// Pure placement of the diorama's scenery (T44 2.3-2.6): the T42 seed rule over the generated props manifest, world
// positions in three units, the coronation set at square 144, ambient spots and the culling rule. No three, no React.

import {
  FINAL_SQUARE,
  layoutProps,
  regionOf,
  seedOf,
  type PlacedProp,
  type PropKind,
  type RegionName,
} from '../../game/board/blockRules';
import { squareWorld } from '../../game/iso/boardIso';
import { FAN_WORLD, FIELD_C_OFFSET, SIZE } from '../../game/iso/world';
import { blockTopY } from './boardLayout';
import { UNIT } from './coords';
import manifest from './propsManifest.json';
import {
  blocksLane,
  bounds,
  lanesOfSquare,
  placeRect,
  fieldCentreU,
  type Lane,
  type Polygon,
  type Rect,
} from './walkways';

export interface ManifestKind extends PropKind {
  tris: number;
  budget: number;
  glow: boolean;
  fly: boolean;
  landmark: boolean;
  glb: 'props' | 'landmarks';
  /** Ground box of the whole kind, relative to its origin (u, three-space axes); measured in Blender. */
  footprint: Rect;
  /** Solid parts of a kind with a doorway (walls, gate, palace); the gap between them is the doorway. */
  colliders?: Rect[];
}

export const MANIFEST_KINDS = manifest.kinds as unknown as Record<string, ManifestKind>;
/** The catalog the T42 seed rule runs over: every kind that stands on blocks (birds and butterflies fly instead). */
export const CATALOG: readonly ManifestKind[] = Object.values(MANIFEST_KINDS).filter((k) => !k.fly);
/** Placement of every square 1..144 (index = square). Identical to `layoutProps` over the same catalog. */
export const PROP_LAYOUT: readonly (readonly PlacedProp[])[] = layoutProps(CATALOG);

/** The solid parts of a kind on the ground: its colliders when it has a doorway, else its footprint box. */
export function solidParts(kind: string): readonly Rect[] {
  const meta = MANIFEST_KINDS[kind];
  if (!meta) return [];
  return meta.colliders ?? [meta.footprint];
}

/** Flat water decals (height 0: foam ring, fish ripple) are walked over; everything else is solid for a hero. */
export function isSolid(kind: string): boolean {
  return (MANIFEST_KINDS[kind]?.height ?? 0) > 0;
}

/** Kinds with a doorway stand square to their lane (no skew), so the doorway lines up with it. */
export function hasDoorway(kind: string): boolean {
  return MANIFEST_KINDS[kind]?.colliders !== undefined;
}

export type BlockTopY = (square: number) => number;
export const defaultBlockTopY: BlockTopY = blockTopY;

export interface PropInstance {
  kind: string;
  square: number;
  /** Three-space position of the prop's base centre. */
  position: [number, number, number];
  /** Heading about the vertical axis, radians (0 faces the viewer). */
  yaw: number;
  /** Uniform render scale (renderScaleOf, jittered for dressing). */
  scale: number;
  /** A small cluster piece added by the charm pass, not by the T42 seed rule. */
  dressing: boolean;
}

/** Kinds that read the same from every side: they take any heading; everything else turns at most ~14 degrees. */
const ROUND_KINDS = new Set([
  'rock',
  'boulder',
  'river-rock',
  'rock-stack',
  'shell',
  'mushroom-cluster',
  'path-stone',
  'marigold-bush',
  'berry-bush',
  'fern',
  'reed',
  'lotus-pad',
  'foam-ring',
  'fish-ripple',
  'wave-crest',
  'haystack',
  'log-pile',
  'potted-plant',
  'basket',
  'mango-tree',
  'sal-tree',
  'dark-tree',
  'banana-plant',
  'buoy-stone',
  'hidden-eyes',
]);
const SKEW = 0.25;

function yawOf(kind: string, square: number): number {
  if (hasDoorway(kind)) return 0;
  const unit = (((seedOf(square) >>> 11) & 255) / 255) * 2 - 1;
  return ROUND_KINDS.has(kind) ? unit * Math.PI : unit * SKEW;
}

/** Three-space spot of a world-unit offset (px from the tile centre) on a square, standing at `y`. */
export function spotOf(square: number, x: number, y: number, top: number): [number, number, number] {
  const [wx, wy] = squareWorld(square);
  return [(wx + x - SIZE / 2) * UNIT, top, (wy + y - SIZE / 2) * UNIT];
}

/** Kinds modelled as landmarks (Landmarks.tsx) are not instanced here, and the dais owns square 144's random props. */
export function isInstancedProp(kind: string, square: number): boolean {
  if (MANIFEST_KINDS[kind]?.landmark) return false;
  return square !== FINAL_SQUARE;
}

// ---------------------------------------------------------------- charm pass (T44.8 look checkpoint)

/**
 * Props are drawn larger than their 22-px model cap so blocks read as lived-in at Fit (owner, T44.8). They stand on
 * the side and back strips, so even scaled they stay well under a hero's shoulders (0.92 u) and off the token field.
 */
export const PROP_HEIGHT_CAP = 0.5;
const SCALE_TALL = 1.25;
const SCALE_MID = 1.4;
const SCALE_FLAT = 1.6;

/** Render scale of a kind: tall kinds grow least, flat ground pieces most. */
export function renderScaleOf(kind: string): number {
  const height = MANIFEST_KINDS[kind]?.height ?? 0;
  if (height >= 17) return SCALE_TALL;
  if (height <= 4) return SCALE_FLAT;
  return SCALE_MID;
}

/**
 * Small kinds that cluster around a block's edges (dressing): ground cover in the region's own vocabulary. They are
 * extra instances of the same InstancedMeshes, so they add triangles but no draw calls.
 */
export const DRESSING_KINDS: Readonly<Record<RegionName, readonly string[]>> = {
  mithila: ['marigold-bush', 'path-stone', 'potted-plant', 'haystack'],
  ayodhya: ['potted-plant', 'bench', 'potted-plant', 'path-stone'],
  dandaka: ['fern', 'mushroom-cluster', 'rock', 'fern', 'log-pile'],
  ganga: ['lotus-pad', 'river-rock', 'lotus-pad', 'fish-ripple'],
  kishkindha: ['berry-bush', 'boulder', 'basket', 'boulder'],
  sea: ['shell', 'foam-ring', 'wave-crest', 'shell'],
  lanka: ['terrace-step', 'rock', 'terrace-step'],
};

/** Dressing slots, px from the tile centre (x right, y toward the viewer): the front sill and the free corners. */
const DRESSING_SLOTS: readonly { x: number; y: number }[] = [
  { x: 17, y: 18 },
  { x: 1, y: 21 },
  { x: -20, y: -24 },
  { x: 20, y: -24 },
  { x: -21, y: 6 },
  { x: 21, y: 6 },
];
/** A dressing slot this close (px) to a seed-rule prop is taken. */
const SLOT_CLEARANCE = 13;
export const DRESSING_PER_BLOCK = 2;

/** Second hash so dressing never correlates with the T42 bits. */
function dressingSeed(square: number, k: number): number {
  return (Math.imul(seedOf(square) ^ (k * 0x9e3779b9), 0x85ebca6b) >>> 0) ^ (square << 7);
}

/** Dressing of a square: up to two small kinds in free slots, never on the token field or the chip corner. */
export function dressingOf(square: number): (PlacedProp & { scale: number })[] {
  if (square === FINAL_SQUARE) return [];
  const kinds = DRESSING_KINDS[regionOf(square)];
  const taken = (SCENERY_LAYOUT[square] ?? []).map((p) => ({ x: p.x, y: p.y }));
  const free = DRESSING_SLOTS.filter((slot) =>
    taken.every((p) => Math.hypot(p.x - slot.x, p.y - slot.y) >= SLOT_CLEARANCE),
  );
  const lanes = lanesOf(square);
  const out: (PlacedProp & { scale: number })[] = [];
  for (let k = 0; k < DRESSING_PER_BLOCK && free.length > 0; k++) {
    const seed = dressingSeed(square, k);
    const kind = kinds[(seed >>> 8) % kinds.length]!;
    const jitterX = ((seed >>> 16) % 5) - 2;
    const jitterY = ((seed >>> 20) % 5) - 2;
    const scale = renderScaleOf(kind) * (0.75 + (((seed >>> 24) & 255) / 255) * 0.3);
    const yaw = dressingYaw(square, kind, out.length);
    // the seed picks a slot; a slot whose piece would stand in a walkway passes to the next one (T45.2)
    const first = seed % free.length < 0 ? (seed % free.length) + free.length : seed % free.length; // as splice(negative)
    let chosen: { index: number; x: number; y: number } | undefined;
    for (let i = 0; i < free.length && !chosen; i++) {
      const index = (first + i) % free.length;
      const slot = free[index]!;
      for (const [jx, jy] of [
        [jitterX, jitterY],
        [0, 0],
      ] as const) {
        const polygons = solidPolygons(kind, square, slot.x + jx, slot.y + jy, scale, yaw);
        if (clearOfLanes(polygons, lanes)) {
          chosen = { index, x: slot.x + jx, y: slot.y + jy };
          break;
        }
      }
    }
    if (!chosen) continue;
    free.splice(chosen.index, 1);
    out.push({ kind, x: chosen.x, y: chosen.y, scale });
  }
  return out;
}

function dressingYaw(square: number, kind: string, index: number): number {
  const unit = ((dressingSeed(square, index + 7) & 1023) / 1023) * 2 - 1;
  return ROUND_KINDS.has(kind) ? unit * Math.PI : unit * SKEW;
}

/** Every prop standing on the board (random and fixed, then the dressing), in square order. */
export function layoutInstances(blockTopY: BlockTopY = defaultBlockTopY): PropInstance[] {
  const out: PropInstance[] = [];
  for (let square = 1; square <= FINAL_SQUARE; square++) {
    for (const placed of SCENERY_LAYOUT[square] ?? []) {
      if (!isInstancedProp(placed.kind, square)) continue;
      out.push({
        kind: placed.kind,
        square,
        position: spotOf(square, placed.x, placed.y, blockTopY(square)),
        yaw: yawOf(placed.kind, square) + placed.turn,
        scale: renderScaleOf(placed.kind) * placed.fit,
        dressing: false,
      });
    }
    dressingOf(square).forEach((placed, k) => {
      out.push({
        kind: placed.kind,
        square,
        position: spotOf(square, placed.x, placed.y, blockTopY(square)),
        yaw: dressingYaw(square, placed.kind, k),
        scale: placed.scale,
        dressing: true,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------- landmarks

/** Metres of rim between the block-1 gate and the block centre (gate stands on the rim strip south of block 1). */
export const GATE_OFFSET_Z = 0.58;
const PX = 1 / 56;

export interface CoronationSet {
  /** Block-centre-relative (x, z) in u, z toward the viewer. */
  throne: [number, number];
  pole: [number, number];
  canopyRadius: number;
  canopyHeight: number;
}

/** Chhatra canopy centre sits this far behind the standing-field centre (T44 2.5 gives 0.42; 0.50 clears fanned tokens). */
export const CANOPY_BEHIND = 0.5;
export const CANOPY_RADIUS = 0.34;
/** Canopy rim height: well above a standing hero (80 px) so it never sits behind a head like a halo (R6). */
export const CANOPY_HEIGHT = 104 * PX;
export const THRONE_Z = -0.485;
/** The dais ring is 0.08 u tall; the throne stands on it. */
export const DAIS_HEIGHT = 4.6 * PX;

const FIELD_Z = FIELD_C_OFFSET[1] * UNIT;

export const CORONATION: CoronationSet = {
  throne: [0, THRONE_Z],
  pole: [0, FIELD_Z - CANOPY_BEHIND],
  canopyRadius: CANOPY_RADIUS,
  canopyHeight: CANOPY_HEIGHT,
};

/** Block-centre-relative (x, z) in u of every token fan slot on a square, for 1..4 tokens. */
export function fanSlots(): [number, number][] {
  const seen = new Map<string, [number, number]>();
  for (const count of [1, 2, 3, 4] as const)
    for (const [dx, dy] of FAN_WORLD[count]) {
      const slot: [number, number] = [(FIELD_C_OFFSET[0] + dx) * UNIT, (FIELD_C_OFFSET[1] + dy) * UNIT];
      seen.set(slot.join(','), slot);
    }
  return [...seen.values()];
}

/** True when a ground point lies under the chhatra canopy disc (seen from above, `margin` u of slack). */
export function underCanopy(x: number, z: number, margin = 0): boolean {
  const [px, pz] = CORONATION.pole;
  return Math.hypot(x - px, z - pz) < CORONATION.canopyRadius + margin;
}

// ---------------------------------------------------------------- walkways (T45.2)

/**
 * A seed-rule prop after the walkway pass: its offset (px from the tile centre), an extra quarter turn, and `fit`, the
 * share of its render scale it keeps (1, or less when a big piece only fits its block smaller).
 */
export interface ScenicProp extends PlacedProp {
  turn: number;
  fit: number;
}

/** Palace yaw: the long hall faces the block centre (the front turns toward +x on a left strip, -x on a right one). */
export const palaceYaw = (x: number): number => (x < 0 ? Math.PI / 2 : -Math.PI / 2);

/** The lane from the gate on the rim, between its two posts, to square 1's field centre. */
export function gateLane(): Lane {
  const [x, , z] = spotOf(1, 0, 0, 0);
  return { a: [x, z + GATE_OFFSET_Z], b: fieldCentreU(1) };
}

/** Every lane that crosses a block: the steps to its neighbours, its fan spokes and, on 1, the gate lane. */
export function lanesOf(square: number): Lane[] {
  const lanes = lanesOfSquare(square);
  if (square === 1) lanes.push(gateLane());
  return lanes;
}

/** The solid ground polygons of a prop of `kind` standing `x`, `y` px from a block centre ([] for a flat decal). */
export function solidPolygons(
  kind: string,
  square: number,
  x: number,
  y: number,
  scale: number,
  yaw: number,
): Polygon[] {
  if (!isSolid(kind)) return [];
  const [px, , pz] = spotOf(square, x, y, 0);
  return solidParts(kind).map((part) => placeRect(part, [px, pz], yaw, scale));
}

export function clearOfLanes(polygons: readonly Polygon[], lanes: readonly Lane[]): boolean {
  return polygons.every((polygon) => lanes.every((lane) => !blocksLane(polygon, lane)));
}

/** Solid pieces of the landmarks that stand on blocks: the gate on the rim, the palace hall, the empty throne. */
export function landmarkSolids(): { name: string; square: number; polygons: Polygon[] }[] {
  const out: { name: string; square: number; polygons: Polygon[] }[] = [];
  const [gx, , gz] = gatePosition(0);
  out.push({
    name: 'ayodhya-threshold',
    square: 1,
    polygons: solidParts('ayodhya-threshold').map((part) => placeRect(part, [gx, gz], 0, 1)),
  });
  const palace = PROP_LAYOUT[36]?.find((p) => p.kind === 'janaka-palace');
  if (palace) {
    const [px, , pz] = spotOf(36, palace.x, palace.y, 0);
    out.push({
      name: 'janaka-palace',
      square: 36,
      polygons: solidParts('janaka-palace').map((part) => placeRect(part, [px, pz], palaceYaw(palace.x), 1)),
    });
  }
  const throne = coronationSpots(0).throne;
  const seat = (manifest.landmarkMeshes as unknown as Record<string, { colliders?: Rect[] }>).throne?.colliders ?? [];
  out.push({
    name: 'throne',
    square: FINAL_SQUARE,
    polygons: seat.map((part) => placeRect(part, [throne[0], throne[2]], 0, 1)),
  });
  return out;
}

/** Candidate moves (px), nearest first: a prop that stands in a lane slides to the closest free spot. */
const MOVES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let dy = -40; dy <= 40; dy += 2) for (let dx = -40; dx <= 40; dx += 2) out.push([dx, dy]);
  return out.sort((a, b) => Math.hypot(...a) - Math.hypot(...b) || b[1] - a[1] || a[0] - b[0]);
})();
/** A moved prop's origin stays on its block, off the token field core and the chip corner (the T44 placement rules). */
/** A doorway kind's side-strip distance from the block centre (px): its inner face clears the fan slots. */
const WALL_X = 23;
/** A big piece that fits nowhere at full size is tried smaller: these shares of its render scale, in order. */
const FITS: readonly number[] = [1, 0.85, 0.7, 0.55];
const CENTRE_LIMIT = 26;
const POLYGON_LIMIT = 0.62;
const PROP_GAP = 0.02;

function allowedSpot(x: number, y: number): boolean {
  if (Math.abs(x) > CENTRE_LIMIT || Math.abs(y) > CENTRE_LIMIT) return false;
  if (Math.abs(x) < 16 && y > -22 && y < 4) return false;
  return !(x < -10 && y > 12);
}

function apart(a: readonly Polygon[], b: readonly Polygon[]): boolean {
  return a.every((p) =>
    b.every((q) => {
      const u = bounds(p);
      const v = bounds(q);
      return u.x1 + PROP_GAP < v.x0 || v.x1 + PROP_GAP < u.x0 || u.z1 + PROP_GAP < v.z0 || v.z1 + PROP_GAP < u.z0;
    }),
  );
}

function withinBlock(polygons: readonly Polygon[], square: number): boolean {
  const [cx, , cz] = spotOf(square, 0, 0, 0);
  return polygons.every((polygon) => {
    const box = bounds(polygon);
    const reach = Math.max(
      Math.abs(box.x0 - cx),
      Math.abs(box.x1 - cx),
      Math.abs(box.z0 - cz),
      Math.abs(box.z1 - cz),
    );
    return reach <= POLYGON_LIMIT;
  });
}

/**
 * The seed rule's props with every prop moved out of the walkways. A prop that stands clear stays; a doorway kind
 * (wall, palace) stays and lets the lane through its gap; any other prop that blocks a lane slides to the nearest spot on
 * its block that is clear of every lane, other props and the token field, quarter-turned when only that fits (long
 * crops). Square 144 is the coronation set's.
 */
export const SCENERY_LAYOUT: readonly (readonly ScenicProp[])[] = (() => {
  const out: ScenicProp[][] = [[]];
  for (let square = 1; square <= FINAL_SQUARE; square++) {
    const placed: ScenicProp[] = (PROP_LAYOUT[square] ?? []).map((p) => ({ ...p, turn: 0, fit: 1 }));
    // a wall's doorway sits on the lane: the wall stands on the lane's line (the field centre's y), on its side strip
    for (const p of placed)
      if (hasDoorway(p.kind) && Math.abs(p.x) > 16) {
        p.y = FIELD_C_OFFSET[1];
        p.x = Math.sign(p.x) * WALL_X;
      }
    if (square === FINAL_SQUARE) {
      out.push(placed);
      continue;
    }
    const lanes = lanesOf(square);
    const polygonsOf = (p: ScenicProp, turn = p.turn, fit = p.fit): Polygon[] =>
      solidPolygons(
        p.kind,
        square,
        p.x,
        p.y,
        renderScaleOf(p.kind) * fit,
        p.kind === 'janaka-palace' ? palaceYaw(p.x) : yawOf(p.kind, square) + turn,
      );
    const fixed = (p: ScenicProp): boolean =>
      MANIFEST_KINDS[p.kind]?.landmark === true || hasDoorway(p.kind) || clearOfLanes(polygonsOf(p), lanes);
    const standing: Polygon[] = placed.filter(fixed).flatMap((p) => polygonsOf(p));
    for (const prop of placed.filter((p) => !fixed(p))) {
      const turns = ROUND_KINDS.has(prop.kind) ? [0] : [0, Math.PI / 2];
      const found = FITS.some((fit) =>
        turns.some((turn) =>
          MOVES.some(([dx, dy]) => {
            const moved = { ...prop, x: prop.x + dx, y: prop.y + dy };
            if (!allowedSpot(moved.x, moved.y)) return false;
            const polygons = polygonsOf(moved, turn, fit);
            if (!clearOfLanes(polygons, lanes) || !withinBlock(polygons, square) || !apart(polygons, standing))
              return false;
            prop.x = moved.x;
            prop.y = moved.y;
            prop.turn = turn;
            prop.fit = fit;
            standing.push(...polygons);
            return true;
          }),
        ),
      );
      if (!found) standing.push(...polygonsOf(prop));
    }
    out.push(placed);
  }
  return out;
})();

// ---------------------------------------------------------------- ambient spots

export interface Spot {
  square: number;
  position: [number, number, number];
}

const GLOW_HEIGHT_PX: Record<string, number> = { lamp: 10.4, 'gold-lamp': 12.4, fire: 5, 'hidden-eyes': 5.4 };
/** Chimney / flame mouth of the smoking kinds, px from the prop's base: x right, y toward the viewer, z up. */
const SMOKE_PX: Record<string, [number, number, number]> = {
  'sage-hut': [3.4, -1.5, 10],
  'panchavati-hut': [3, -1.5, 10],
  fire: [0, 0, 8],
};

function spotsOf(
  table: Record<string, unknown>,
  blockTopY: BlockTopY,
  shift: (kind: string) => [number, number, number],
): Spot[] {
  const out: Spot[] = [];
  for (const placed of layoutInstances(blockTopY)) {
    if (!(placed.kind in table)) continue;
    const [dx, dz, dy] = shift(placed.kind).map((d) => d * placed.scale) as [number, number, number];
    const [x, y, z] = placed.position;
    out.push({ square: placed.square, position: [x + dx, y + dy, z + dz] });
  }
  return out;
}

/** Flame sprites: lamps, gold lamps, the two Lanka fires and the gate's two hanging lamps. */
export function glowSpots(blockTopY: BlockTopY = defaultBlockTopY): Spot[] {
  const spots = spotsOf(GLOW_HEIGHT_PX, blockTopY, (kind) => [0, 0, (GLOW_HEIGHT_PX[kind] ?? 0) * PX]);
  const top = blockTopY(1);
  const [gx, , gz] = gatePosition(top);
  for (const sx of [-1, 1])
    spots.push({ square: 1, position: [gx + sx * 9.5 * PX, top + 23 * PX, gz + 2 * PX] });
  return spots;
}

export function smokeSpots(blockTopY: BlockTopY = defaultBlockTopY): Spot[] {
  return spotsOf(SMOKE_PX, blockTopY, (kind) => {
    const [x, y, z] = SMOKE_PX[kind]!;
    return [x * PX, y * PX, z * PX];
  });
}

/** Where the gate stands: on the rim strip south of block 1 (`rimTopY` defaults to the block top). */
export function gatePosition(rimTopY: number): [number, number, number] {
  const [x, y, z] = spotOf(1, 0, 0, rimTopY);
  return [x, y, z + GATE_OFFSET_Z];
}

/** The coronation set's three-space spots on square 144 (dais centre, throne, pole foot). */
export function coronationSpots(top: number): {
  dais: [number, number, number];
  throne: [number, number, number];
  pole: [number, number, number];
} {
  const [x, y, z] = spotOf(FINAL_SQUARE, 0, 0, top);
  return {
    dais: [x, y, z],
    throne: [x + CORONATION.throne[0], y + DAIS_HEIGHT, z + CORONATION.throne[1]],
    pole: [x + CORONATION.pole[0], y, z + CORONATION.pole[1]],
  };
}

// ---------------------------------------------------------------- ambient rules (T44 2.6)

export interface AmbientFeatures {
  sway: boolean;
  flicker: boolean;
  smoke: boolean;
  birds: boolean;
  butterflies: boolean;
  motes: boolean;
}

/** `prefers-reduced-motion`: sway, flicker, smoke, birds, butterflies and motes are all off. */
export function ambientFeatures(reducedMotion: boolean): AmbientFeatures {
  const on = !reducedMotion;
  return { sway: on, flicker: on, smoke: on, birds: on, butterflies: on, motes: on };
}

/** Ambient runs only for revealed blocks inside the camera frustum plus one block (T44 2.6 rules). */
export function activeSquares(
  revealed: ReadonlySet<number>,
  inFrustum: (square: number) => boolean,
): Set<number> {
  const out = new Set<number>();
  for (const square of revealed)
    if (square >= 1 && square <= FINAL_SQUARE && inFrustum(square)) out.add(square);
  return out;
}

/** Block-centre three-space x, z of a square. */
export function blockCentre(square: number): [number, number] {
  const [x, , z] = spotOf(square, 0, 0, 0);
  return [x, z];
}

export interface BirdRoute {
  name: 'jatayu' | 'gull' | 'crow' | 'parrot-a' | 'parrot-b';
  /** 1-based board rows whose revealed blocks switch the bird on. */
  rows: [number, number];
  height: number;
  /** Ellipse half-axes in u, centre z in u. */
  ax: number;
  az: number;
  cz: number;
  cx: number;
  scale: number;
  tint: string;
  phase: number;
}

/** z of the centre of a 1-based row: row 1 is the front (+z) row, row 12 the back. */
export const rowZ = (row: number): number => 5.5 - (row - 1);

export const BIRD_ROUTES: readonly BirdRoute[] = [
  {
    name: 'jatayu',
    rows: [6, 8],
    height: 1.2,
    ax: 4.4,
    az: 1.1,
    cx: 0,
    cz: rowZ(7),
    scale: 2.3,
    tint: '#C79A66',
    phase: 0,
  },
  {
    name: 'gull',
    rows: [10, 10],
    height: 0.7,
    ax: 4.6,
    az: 0.5,
    cx: 0,
    cz: rowZ(10),
    scale: 1.2,
    tint: '#FFFFFF',
    phase: 2,
  },
  {
    name: 'crow',
    rows: [12, 12],
    height: 0.85,
    ax: 3.8,
    az: 0.45,
    cx: 0,
    cz: rowZ(12),
    scale: 1.1,
    tint: '#7A7388',
    phase: 4,
  },
  {
    name: 'parrot-a',
    rows: [2, 2],
    height: 0.6,
    ax: 3.6,
    az: 0.4,
    cx: -1,
    cz: rowZ(2),
    scale: 1.0,
    tint: '#7FD07A',
    phase: 1,
  },
  {
    name: 'parrot-b',
    rows: [2, 2],
    height: 0.65,
    ax: 3.4,
    az: 0.45,
    cx: 1,
    cz: rowZ(2),
    scale: 1.0,
    tint: '#F27A6C',
    phase: 3.4,
  },
];
export const BIRD_LOOP_SECONDS = 14;

export function birdPose(route: BirdRoute, seconds: number): { x: number; z: number; yaw: number } {
  const theta = (2 * Math.PI * seconds) / BIRD_LOOP_SECONDS + route.phase;
  const x = route.cx + route.ax * Math.cos(theta);
  const z = route.cz + route.az * Math.sin(theta);
  const dx = -route.ax * Math.sin(theta);
  const dz = route.az * Math.cos(theta);
  return { x, z, yaw: Math.atan2(dx, dz) };
}

/** Squares of 1-based rows `a..b` (the serpentine numbering is irrelevant to a row band). */
export function squaresOfRows(a: number, b: number): number[] {
  const out: number[] = [];
  for (let row = a; row <= b; row++) for (let i = 1; i <= 12; i++) out.push((row - 1) * 12 + i);
  return out;
}

export const BUTTERFLY_COUNT = 6;
export const MITHILA_SQUARES: readonly number[] = Array.from(
  { length: FINAL_SQUARE },
  (_, i) => i + 1,
).filter((s) => regionOf(s) === 'mithila');
