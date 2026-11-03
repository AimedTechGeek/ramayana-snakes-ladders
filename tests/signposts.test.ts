// Stage signposts (T46.6): one small wooden signpost per stage on the stage's first block, at a prop's scale, out of
// every walking lane and fan slot, clear of coils, bridges and landmarks, and hiding no number chip and not the throne
// from the default camera.
import { describe, expect, it } from 'vitest';
import { STORY_JUMPS } from '../src/core/boards';
import {
  BLOCK_HALF,
  SLAB_HALF,
  blockTopY,
  chipAnchor,
  squareCentre,
  terraceY,
  rowOf,
} from '../src/app/board3d/boardLayout';
import { bridges, DECK_WIDTH, PARAPET_WIDTH } from '../src/app/board3d/bridgeGeometry';
import { FIT_AZIMUTH, FIT_POLAR } from '../src/app/board3d/cameraConfig';
import { CHIP_HEIGHT, CHIP_WIDTH } from '../src/app/board3d/chips';
import { HERO_SCALE } from '../src/app/board3d/figureScale';
import {
  DAIS_HEIGHT,
  MANIFEST_KINDS,
  clearOfLanes,
  coronationSpots,
  gateLane,
  landmarkSolids,
  lanesOf,
  layoutInstances,
  solidParts,
} from '../src/app/board3d/propLayout';
import {
  SIGN_BOARD_BOTTOM,
  SIGN_BOARD_WIDTH,
  SIGN_FOOT,
  SIGN_HEIGHT,
  signpostFootY,
  signpostPolygons,
  signpostSpots,
  signUvCell,
} from '../src/app/board3d/signpostLayout';
import { snakeAnchor } from '../src/app/board3d/snakeChoreo';
import snakesManifest from '../src/app/board3d/snakesManifest.json';
import {
  bounds,
  placeRect,
  segmentPolygonDistance,
  type Point,
  type Polygon,
} from '../src/app/board3d/walkways';
import { gridOf } from '../src/game/layout';
import { FINAL_SQUARE } from '../src/game/board/blockRules';
import { STAGES } from '../src/game/stages';

const SPOTS = signpostSpots();
/** The authored hero stands 1.43 u; on the board it is drawn at HERO_SCALE. */
const HERO_HEIGHT = 1.43 * HERO_SCALE;

function overlap(a: Polygon, b: Polygon, gap = 0): boolean {
  const u = bounds(a);
  const v = bounds(b);
  return !(u.x1 + gap < v.x0 || v.x1 + gap < u.x0 || u.z1 + gap < v.z0 || v.z1 + gap < u.z0);
}

// The default camera's view (Fit): an orthographic projection along its direction is close enough at Fit distance.
const right = [Math.cos(FIT_AZIMUTH), 0, -Math.sin(FIT_AZIMUTH)] as const;
const into = [
  -Math.sin(FIT_POLAR) * Math.sin(FIT_AZIMUTH),
  -Math.cos(FIT_POLAR),
  -Math.sin(FIT_POLAR) * Math.cos(FIT_AZIMUTH),
] as const;
const up = [
  right[1] * into[2] - right[2] * into[1],
  right[2] * into[0] - right[0] * into[2],
  right[0] * into[1] - right[1] * into[0],
].map((c, _, all) => (all[1]! > 0 ? c : -c));
const dot = (p: readonly number[], q: readonly number[]): number =>
  p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;

interface ScreenBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Nearest depth along the view (smaller is nearer the camera). */
  near: number;
  far: number;
}

function screenBox(points: readonly (readonly number[])[]): ScreenBox {
  const xs = points.map((p) => dot(p, right));
  const ys = points.map((p) => dot(p, up));
  const ds = points.map((p) => dot(p, into));
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
    near: Math.min(...ds),
    far: Math.max(...ds),
  };
}

const crosses = (a: ScreenBox, b: ScreenBox): boolean =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The sign board as the default camera sees it. */
function boardOnScreen(spot: (typeof SPOTS)[number]): ScreenBox {
  const board = signpostPolygons(spot)[1]!;
  const foot = signpostFootY(spot.square, DAIS_HEIGHT);
  return screenBox(
    board.flatMap(([x, z]) => [foot + SIGN_BOARD_BOTTOM, foot + SIGN_HEIGHT].map((y) => [x, y, z])),
  );
}

/** A number chip at Fit: the billboard grows with distance (chipMaterial: up to x2.5; ~x1.8 at desktop Fit). */
const FIT_CHIP_SCALE = 1.8;
function chipOnScreen(square: number): ScreenBox {
  const [x, y, z] = chipAnchor(square);
  const sx = dot([x, y, z], right);
  const sy = dot([x, y, z], up);
  const d = dot([x, y, z], into);
  const hw = (CHIP_WIDTH * FIT_CHIP_SCALE) / 2;
  const hh = (CHIP_HEIGHT * FIT_CHIP_SCALE) / 2;
  return { x0: sx - hw, x1: sx + hw, y0: sy - hh, y1: sy + hh, near: d, far: d };
}

describe('signposts', () => {
  it('EveryStage_Should_HaveOneSignpostOnItsFirstBlock', () => {
    expect(SPOTS.map((spot) => [spot.id, spot.square])).toEqual(
      STAGES.map((stage) => [stage.id, stage.from]),
    );
    for (const spot of SPOTS) {
      const [cx, cz] = squareCentre(spot.square);
      // the foot stone stands on the block top
      const reach = BLOCK_HALF - SIGN_FOOT / 2;
      expect(Math.abs(spot.at[0] - cx), spot.id).toBeLessThanOrEqual(reach);
      expect(Math.abs(spot.at[1] - cz), spot.id).toBeLessThanOrEqual(reach);
    }
  });

  it('ASignpost_Should_BePropSized_ShorterThanAHero', () => {
    expect(SIGN_HEIGHT).toBeGreaterThanOrEqual(0.35);
    expect(SIGN_HEIGHT).toBeLessThanOrEqual(0.5);
    expect(SIGN_BOARD_WIDTH).toBeGreaterThanOrEqual(0.4);
    expect(SIGN_BOARD_WIDTH).toBeLessThanOrEqual(0.5);
    expect(SIGN_HEIGHT).toBeLessThan(HERO_HEIGHT * 0.6);
  });

  it('ASignpost_Should_StandOnItsBlockTop_FollowingTheTerraces', () => {
    for (const spot of SPOTS) {
      const foot = signpostFootY(spot.square, DAIS_HEIGHT);
      if (spot.square === FINAL_SQUARE)
        expect(foot).toBeCloseTo(coronationSpots(blockTopY(FINAL_SQUARE)).throne[1], 9);
      else expect(Math.abs(foot - blockTopY(spot.square)), spot.id).toBeLessThanOrEqual(0.011);
      expect(foot, spot.id).toBeGreaterThan(terraceY(rowOf(spot.square)));
    }
  });

  it('ABoard_Should_StayOverItsBlock_OrReachOutOnlyOverTheRim', () => {
    for (const spot of SPOTS) {
      const [cx, cz] = squareCentre(spot.square);
      const box = bounds(signpostPolygons(spot)[1]!);
      const column = gridOf(spot.square).column;
      // the groove half-way to the next block is the limit inward, front and back; the outer side may reach the slab
      const left = column === 0 ? SLAB_HALF : -(cx - 0.5);
      const rightEdge = column === 11 ? SLAB_HALF : cx + 0.5;
      expect(box.x0, spot.id).toBeGreaterThanOrEqual(-left);
      expect(box.x1, spot.id).toBeLessThanOrEqual(rightEdge);
      expect(box.z0, spot.id).toBeGreaterThanOrEqual(cz - 0.5);
      expect(box.z1, spot.id).toBeLessThanOrEqual(cz + 0.5);
    }
  });

  it('ABoard_Should_TurnTowardTheDefaultCamera', () => {
    for (const spot of SPOTS) {
      expect(spot.yaw, spot.id).toBeGreaterThanOrEqual(0);
      expect(spot.yaw, spot.id).toBeLessThanOrEqual(FIT_AZIMUTH + 1e-9);
    }
  });

  it('ASignpost_Should_StayOutOfEveryLaneAndFanSlot', () => {
    for (const spot of SPOTS) {
      const lanes = [spot.square - 1, spot.square, spot.square + 1]
        .filter((square) => square >= 1 && square <= FINAL_SQUARE)
        .flatMap(lanesOf);
      lanes.push(gateLane());
      expect(clearOfLanes(signpostPolygons(spot), lanes), spot.id).toBe(true);
    }
  });

  it('ASignpost_Should_StandClearOfCoilsBridgesAndLandmarks', () => {
    const meta = snakesManifest.snakes as unknown as Record<
      string,
      { footprint_u: { x: [number, number]; z: [number, number] } }
    >;
    const decks = [...bridges().values()];
    const landmarks = landmarkSolids().flatMap((solid) => solid.polygons);
    for (const spot of SPOTS) {
      const sign = signpostPolygons(spot);
      for (const jump of STORY_JUMPS.filter((j) => j.kind === 'snake' && j.from === spot.square)) {
        const [ax, , az] = snakeAnchor(jump.from, jump.id);
        const coil = placeRect(meta[jump.id]!.footprint_u, [ax, az], 0, 1);
        expect(
          sign.some((part) => overlap(part, coil, 0.03)),
          `${spot.id} vs ${jump.id}`,
        ).toBe(false);
      }
      for (const bridge of decks.filter((b) => b.from === spot.square || b.to === spot.square))
        for (let i = 0; i + 1 < bridge.deck.length; i++) {
          const a: Point = [bridge.deck[i]!.x, bridge.deck[i]!.z];
          const b: Point = [bridge.deck[i + 1]!.x, bridge.deck[i + 1]!.z];
          for (const part of sign)
            expect(segmentPolygonDistance(a, b, part), `${spot.id} vs ${bridge.id}`).toBeGreaterThan(
              DECK_WIDTH / 2 + PARAPET_WIDTH,
            );
        }
      for (const landmark of landmarks)
        expect(
          sign.some((part) => overlap(part, landmark, 0.02)),
          spot.id,
        ).toBe(false);
    }
  });

  it('Props_Should_KeepClearOfEverySignpost', () => {
    const clashes: string[] = [];
    for (const inst of layoutInstances()) {
      if ((MANIFEST_KINDS[inst.kind]?.height ?? 0) <= 0) continue;
      const polygons = solidParts(inst.kind).map((part) =>
        placeRect(part, [inst.position[0], inst.position[2]], inst.yaw, inst.scale),
      );
      for (const spot of SPOTS)
        if (polygons.some((p) => signpostPolygons(spot).some((q) => overlap(p, q))))
          clashes.push(`${inst.kind} on ${inst.square} vs ${spot.id}`);
    }
    expect(clashes).toEqual([]);
  });

  it('ASignpost_FromTheDefaultCamera_Should_HideNoNumberChip', () => {
    const hidden: string[] = [];
    for (const spot of SPOTS) {
      const board = boardOnScreen(spot);
      for (let square = 1; square <= FINAL_SQUARE; square++) {
        const chip = chipOnScreen(square);
        if (chip.near > board.near && crosses(board, chip)) hidden.push(`${spot.id} hides ${square}`);
      }
    }
    expect(hidden).toEqual([]);
  });

  it('TheThronesSignpost_FromTheDefaultCamera_Should_LeaveTheThroneInView', () => {
    const spot = SPOTS.find((s) => s.id === 'throne')!;
    const [tx, ty, tz] = coronationSpots(blockTopY(FINAL_SQUARE)).throne;
    const seat = (landmarkSolids().find((s) => s.name === 'throne')!.polygons[0] ?? []).map(([x, z]) => [
      x,
      z,
    ]);
    expect(seat.length).toBe(4);
    const throne = screenBox(seat.flatMap(([x, z]) => [ty, ty + 0.45].map((y) => [x!, y, z!])));
    expect(Math.hypot(tx - spot.at[0], tz - spot.at[1])).toBeGreaterThan(0.3);
    expect(crosses(boardOnScreen(spot), throne)).toBe(false);
  });

  it('EveryBoard_Should_ReadItsOwnAtlasCell', () => {
    const cells = SPOTS.map((_, i) => signUvCell(i));
    for (const cell of cells) {
      expect(cell.u).toBeGreaterThanOrEqual(0);
      expect(cell.v).toBeGreaterThanOrEqual(0);
      expect(cell.u + cell.width).toBeLessThanOrEqual(1);
      expect(cell.v + cell.height).toBeLessThanOrEqual(1);
    }
    expect(new Set(cells.map((c) => `${c.u},${c.v}`)).size).toBe(SPOTS.length);
  });
});
