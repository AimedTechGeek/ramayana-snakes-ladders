// Walkways (T45.2): a reserved lane along every square-to-square step, scenery kept out of it, doorways on the lane,
// and every walk of every level free of collisions with props and landmarks.
import { describe, expect, it } from 'vitest';
import { boardFor } from '../src/core/boards';
import { resolveMove } from '../src/core/game';
import type { Level } from '../src/core/types';
import { fieldCentre } from '../src/game/iso/boardIso';
import { pathOf } from '../src/game/iso/locomotion';
import { restingSpot } from '../src/game/iso/tokenPose';
import { HALF, UNIT } from '../src/app/board3d/coords';
import {
  MANIFEST_KINDS,
  SCENERY_LAYOUT,
  clearOfLanes,
  dressingOf,
  gateLane,
  hasDoorway,
  landmarkSolids,
  lanesOf,
  layoutInstances,
  solidParts,
} from '../src/app/board3d/propLayout';
import {
  FAN_OFFSETS,
  HERO_RADIUS,
  LANE_WIDTH,
  fieldCentreU,
  placeRect,
  segmentPolygonDistance,
  stepLane,
  type Point,
  type Polygon,
} from '../src/app/board3d/walkways';

const SQUARES = Array.from({ length: 144 }, (_, i) => i + 1);
const toU = (world: readonly [number, number]): Point => [(world[0] - HALF) * UNIT, (world[1] - HALF) * UNIT];
const isSolidKind = (kind: string): boolean => (MANIFEST_KINDS[kind]?.height ?? 0) > 0;

interface Solid {
  name: string;
  polygons: Polygon[];
}

/** The solid ground polygons of every rendered instance (placed as the renderer places them) and landmark, per square. */
function solidsBySquare(): Map<number, Solid[]> {
  const out = new Map<number, Solid[]>();
  const add = (square: number, solid: Solid): void => {
    out.set(square, [...(out.get(square) ?? []), solid]);
  };
  for (const inst of layoutInstances()) {
    if (!isSolidKind(inst.kind)) continue;
    const at: Point = [inst.position[0], inst.position[2]];
    const polygons = solidParts(inst.kind).map((part) => placeRect(part, at, inst.yaw, inst.scale));
    add(inst.square, { name: inst.kind + (inst.dressing ? ' (dressing)' : ''), polygons });
  }
  for (const solid of landmarkSolids()) add(solid.square, { name: solid.name, polygons: solid.polygons });
  return out;
}

describe('walkway lanes', () => {
  it('Lane_(Width)_Should_BeAtLeast022Units', () => {
    expect(LANE_WIDTH).toBeGreaterThanOrEqual(0.22);
    expect(HERO_RADIUS * 2).toBeCloseTo(LANE_WIDTH, 9);
  });

  it('Lane_(EverySquareStep)_Should_BeTheLineOfPathOfBetweenFieldCentres', () => {
    for (let square = 1; square < 144; square++) {
      const lane = stepLane(square, square + 1);
      const path = pathOf(fieldCentre(square), [square + 1], fieldCentre(square + 1));
      const first = toU(path.points[0]!);
      const last = toU(path.points[path.points.length - 1]!);
      expect(first[0]).toBeCloseTo(lane.a[0], 9);
      expect(first[1]).toBeCloseTo(lane.a[1], 9);
      expect(last[0]).toBeCloseTo(lane.b[0], 9);
      expect(last[1]).toBeCloseTo(lane.b[1], 9);
    }
  });

  it('Lane_(FanSpokes)_Should_ReachEveryRestingSpot', () => {
    for (const count of [1, 2, 3, 4] as const)
      for (let slot = 0; slot < count; slot++) {
        const spot = toU(restingSpot(10, slot, count));
        const centre = fieldCentreU(10);
        const hit = FAN_OFFSETS.some(
          ([dx, dz]) => Math.abs(centre[0] + dx - spot[0]) < 1e-9 && Math.abs(centre[1] + dz - spot[1]) < 1e-9,
        );
        expect(hit, `${count} tokens, slot ${slot}`).toBe(true);
      }
  });
});

describe('scenery keeps out of the lanes', () => {
  const solids = solidsBySquare();

  it('Props_(NoInstanceFootprint)_Should_IntersectAnyLaneOnItsBlock', () => {
    const blocked: string[] = [];
    for (const square of SQUARES)
      for (const solid of solids.get(square) ?? [])
        if (!clearOfLanes(solid.polygons, lanesOf(square))) blocked.push(`${solid.name} on ${square}`);
    expect(blocked).toEqual([]);
  });

  it('Landmarks_(GateAndPalace)_Should_LeaveTheirDoorwayOnTheLane', () => {
    const gate = landmarkSolids().find((s) => s.name === 'ayodhya-threshold')!;
    expect(clearOfLanes(gate.polygons, [gateLane()])).toBe(true);
    const palace = landmarkSolids().find((s) => s.name === 'janaka-palace')!;
    expect(clearOfLanes(palace.polygons, lanesOf(36))).toBe(true);
  });

  it('Walls_(RampartAndLankaWall)_Should_HaveADoorwayWiderThanALaneAndCentredOnIt', () => {
    for (const [square, kind] of [
      [47, 'rampart'],
      [48, 'rampart'],
      [121, 'lanka-wall'],
      [132, 'lanka-wall'],
    ] as const) {
      expect(hasDoorway(kind)).toBe(true);
      const parts = solidParts(kind);
      expect(parts.length, kind).toBe(2);
      const gap = parts[1]!.z[0] - parts[0]!.z[1];
      const inst = layoutInstances().find((i) => i.square === square && i.kind === kind);
      expect(inst, `${kind} on ${square}`).toBeDefined();
      expect(inst!.yaw, 'doorway kinds stand square to the lane').toBe(0);
      expect(gap * inst!.scale, kind).toBeGreaterThanOrEqual(LANE_WIDTH + 0.08);
      // the wall's origin is on the lane's line: the field centre's z
      expect(inst!.position[2]).toBeCloseTo(fieldCentreU(square)[1], 3);
    }
  });

  it('Doorways_(PalaceAndGate)_Should_BeWiderThanALane', () => {
    const [a, b] = solidParts('janaka-palace');
    expect(b!.x[0] - a!.x[1]).toBeGreaterThanOrEqual(LANE_WIDTH + 0.08);
    const [left, right] = solidParts('ayodhya-threshold');
    expect(right!.x[0] - left!.x[1]).toBeGreaterThanOrEqual(LANE_WIDTH + 0.08);
  });

  it('Dressing_(EveryPiece)_Should_BeRenderedAndStayOffTheLanes', () => {
    for (const square of SQUARES) {
      const rendered = layoutInstances().filter((i) => i.square === square && i.dressing);
      expect(rendered.length, `square ${square}`).toBe(dressingOf(square).length);
    }
  });

  it('Props_(Moved)_Should_StayOnTheirBlockOffTheTokenFieldCore', () => {
    for (const square of SQUARES)
      for (const p of SCENERY_LAYOUT[square]!) {
        if (p.kind === 'dais') continue;
        expect(Math.abs(p.x) < 16 && p.y > -22 && p.y < 4, `${p.kind} on ${square}`).toBe(false);
        expect(Math.abs(p.x) <= 28 && Math.abs(p.y) <= 28, `${p.kind} on ${square}`).toBe(true);
      }
  });

  it('Props_(EveryKind)_Should_CarryAMeasuredFootprint', () => {
    for (const kind of Object.values(MANIFEST_KINDS)) {
      expect(kind.footprint.x[1], kind.kind).toBeGreaterThan(kind.footprint.x[0]);
      expect(kind.footprint.z[1], kind.kind).toBeGreaterThanOrEqual(kind.footprint.z[0]);
    }
  });
});

describe('every walking path is collision free', () => {
  const solids = solidsBySquare();
  const levels: Level[] = ['easy', 'medium', 'hard'];
  // start and end slots: alone on a square, then crowded (four on a square)
  const slotPairs = [
    [0, 1, 0, 1],
    [3, 4, 2, 4],
    [1, 4, 3, 4],
  ] as const;

  it.each(levels)('Walks_(%s,EverySquareAndRoll)_Should_NotHitAPropOrLandmark', (level) => {
    const board = boardFor(level);
    const hits: string[] = [];
    let walks = 0;
    for (let from = 0; from < 144; from++)
      for (let roll = 1; roll <= 6; roll++) {
        const { path } = resolveMove(board, from, roll);
        const rest = from === 0 ? path.slice(1) : path;
        const last = rest[rest.length - 1];
        if (last === undefined) continue;
        for (const [startSlot, startCount, endSlot, endCount] of slotPairs) {
          const start = from === 0 ? fieldCentre(path[0]!) : restingSpot(from, startSlot, startCount);
          const line = pathOf(start, rest, restingSpot(last, endSlot, endCount));
          walks++;
          for (let i = 0; i + 1 < line.points.length; i++) {
            const a = toU(line.points[i]!);
            const b = toU(line.points[i + 1]!);
            for (const square of new Set([from, ...rest]))
              for (const solid of solids.get(square) ?? [])
                for (const polygon of solid.polygons)
                  if (segmentPolygonDistance(a, b, polygon) < HERO_RADIUS)
                    hits.push(`${from}+${roll}: ${solid.name} on ${square}`);
          }
        }
      }
    expect(walks).toBeGreaterThan(2000);
    expect([...new Set(hits)]).toEqual([]);
  });
});
