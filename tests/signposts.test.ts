// Stage signposts (T46.6): one small wooden signpost per stage on the stage's first block, at a prop's scale, out of
// every walking lane and fan slot, clear of coils, bridges and landmarks, and hiding no number chip and not the throne
// from the default camera at Fit on desktop and phone.
import { Vector3 } from 'three';
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
import { FIT_AZIMUTH, fitPose } from '../src/app/board3d/cameraConfig';
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
  SIGN_BOARD_HEIGHT,
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

// The default camera at Fit on desktop and on a phone (fitPose, no HUD boxes), projected in perspective.
interface View {
  name: string;
  eye: Vector3;
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}

function viewAt(name: string, width: number, height: number): View {
  const { position, target } = fitPose(width, height);
  const forward = target.clone().sub(position).normalize();
  const right = forward
    .clone()
    .cross(new Vector3(0, 1, 0))
    .normalize();
  return { name, eye: position, forward, right, up: right.clone().cross(forward) };
}

const VIEWS: readonly View[] = [viewAt('desktop', 1280, 720), viewAt('phone', 844, 390)];

interface ScreenBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Screen position (tangent units) and view depth of a three-space point. */
function project(view: View, [x, y, z]: readonly number[]): { sx: number; sy: number; depth: number } {
  const v = new Vector3(x, y, z).sub(view.eye);
  const depth = v.dot(view.forward);
  return { sx: v.dot(view.right) / depth, sy: v.dot(view.up) / depth, depth };
}

function screenBox(view: View, points: readonly (readonly number[])[]): ScreenBox {
  const projected = points.map((p) => project(view, p));
  return {
    x0: Math.min(...projected.map((p) => p.sx)),
    x1: Math.max(...projected.map((p) => p.sx)),
    y0: Math.min(...projected.map((p) => p.sy)),
    y1: Math.max(...projected.map((p) => p.sy)),
  };
}

/** Share of box `b` that box `a` covers on screen. */
function covered(a: ScreenBox, b: ScreenBox): number {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return (w * h) / ((b.x1 - b.x0) * (b.y1 - b.y0));
}

/** A board may graze the edge of a chip or of the throne (its box on screen is a little larger than it), no more. */
const MAX_COVER = 0.15;

/** The sign board's corners (as a box on screen: a little larger than the turned board itself). */
function boardCorners(spot: (typeof SPOTS)[number]): number[][] {
  const board = signpostPolygons(spot)[1]!;
  const bottom = signpostFootY(spot.square, DAIS_HEIGHT) + SIGN_BOARD_BOTTOM;
  return board.flatMap(([x, z]) => [bottom, bottom + SIGN_BOARD_HEIGHT].map((y) => [x, y, z]));
}

/** True when a point lies behind the board's face (the face looks along its yaw, toward the camera). */
function behindBoard(spot: (typeof SPOTS)[number], [x, , z]: readonly number[]): boolean {
  const normal = [Math.sin(spot.yaw), Math.cos(spot.yaw)];
  return (x! - spot.at[0]) * normal[0]! + (z! - spot.at[1]) * normal[1]! < 0;
}

/** A number chip on screen: the billboard grows with its view depth (chipMaterial: depth / 10, clamped 1..2.5). */
function chipOnScreen(view: View, square: number): ScreenBox {
  const { sx, sy, depth } = project(view, chipAnchor(square));
  const scale = Math.min(2.5, Math.max(1, depth / 10));
  const hw = (CHIP_WIDTH * scale) / 2 / depth;
  const hh = (CHIP_HEIGHT * scale) / 2 / depth;
  return { x0: sx - hw, x1: sx + hw, y0: sy - hh, y1: sy + hh };
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
      // every bridge that starts, ends or passes over the sign's block: its deck runs clear beside or above the sign
      const top = signpostFootY(spot.square, DAIS_HEIGHT) + SIGN_HEIGHT;
      const near = decks.filter(
        (b) => b.from === spot.square || b.to === spot.square || b.crossed.includes(spot.square),
      );
      for (const bridge of near)
        for (let i = 0; i + 1 < bridge.deck.length; i++) {
          if (Math.min(bridge.deck[i]!.y, bridge.deck[i + 1]!.y) > top + 0.05) continue;
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

  it('ASignpost_AtFitOnDesktopAndPhone_Should_HideNoNumberChip', () => {
    const hidden: string[] = [];
    for (const view of VIEWS)
      for (const spot of SPOTS) {
        const board = screenBox(view, boardCorners(spot));
        for (let square = 1; square <= FINAL_SQUARE; square++)
          if (behindBoard(spot, chipAnchor(square)) && covered(board, chipOnScreen(view, square)) > MAX_COVER)
            hidden.push(`${view.name}: ${spot.id} hides ${square}`);
      }
    expect(hidden).toEqual([]);
  });

  it('TheThronesSignpost_AtFitOnDesktopAndPhone_Should_LeaveTheThroneInView', () => {
    const spot = SPOTS.find((s) => s.id === 'throne')!;
    const [, ty] = coronationSpots(blockTopY(FINAL_SQUARE)).throne;
    const seat = landmarkSolids().find((s) => s.name === 'throne')!.polygons[0] ?? [];
    expect(seat.length).toBe(4);
    // the empty throne stands 0.45 u tall (25.4 px) on the dais
    const throne = seat.flatMap(([x, z]) => [ty, ty + 0.45].map((y) => [x, y, z]));
    expect(throne.every((corner) => behindBoard(spot, corner))).toBe(true);
    for (const view of VIEWS)
      expect(
        covered(screenBox(view, boardCorners(spot)), screenBox(view, throne)),
        view.name,
      ).toBeLessThanOrEqual(MAX_COVER);
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
