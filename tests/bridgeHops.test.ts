// T45.3 bridge hops: every walk on all three levels clears every risen bridge, hops land on the path, the move ends
// on its square, a hop takes at most 0.5 s at normal speed, and hidden bridges never cause a hop.
import { describe, expect, it } from 'vitest';
import { boardFor, LEVELS } from '../src/core/boards';
import type { Hero } from '../src/core/types';
import { gaitFor, pathOf, sampleAt, type Polyline } from '../src/game/iso/locomotion';
import { restingSpot } from '../src/game/iso/tokenPose';
import { groundHeightAt } from '../src/app/board3d/boardLayout';
import { bridgeById, type Bridge } from '../src/app/board3d/bridgeGeometry';
import {
  HOP_CLEARANCE,
  HOP_PAD,
  hopMsFor,
  planHops,
  requiredHeightAt,
  sampleHopWalk,
  glideLift,
} from '../src/app/board3d/bridgeHops';
import { HALF, UNIT } from '../src/app/board3d/coords';

const HEROES: Hero[] = ['hanuman', 'rama', 'lakshmana', 'sita'];

function risenOn(level: (typeof LEVELS)[number]): Bridge[] {
  return boardFor(level).ladders.flatMap((ladder) => bridgeById(ladder.id) ?? []);
}

/** Every walk of 1..6 squares along the board, from the resting spot of the square before it. */
function walks(): { squares: number[]; path: Polyline }[] {
  const out: { squares: number[]; path: Polyline }[] = [];
  for (let start = 1; start <= 143; start++) {
    for (let count = 1; count <= 6 && start + count <= 144; count++) {
      const squares = Array.from({ length: count }, (_, i) => start + 1 + i);
      const last = squares[count - 1]!;
      // the finishing spot is a fan slot: alone, or one of four sharing the square
      const spots = count <= 2 ? [0, 1, 2, 3].map((slot) => restingSpot(last, slot, 4)) : [restingSpot(last, 0, 1)];
      for (const spot of spots) out.push({ squares, path: pathOf(restingSpot(start, 0, 1), squares, spot) });
    }
  }
  return out;
}

const ALL_WALKS = walks();
/**
 * Distances where the walk rests beside an abutment and no hop is planned: a footprint reached within one pad
 * (HOP_PAD) of the path start or end leaves no room to take off or land.
 */
function restingRuns(path: Polyline, risen: Bridge[]): (d: number) => boolean {
  const pad = HOP_PAD / UNIT;
  const inside = (d: number): boolean => {
    const [wx, wy] = sampleAt(path, d).point;
    return requiredHeightAt((wx - HALF) * UNIT, (wy - HALF) * UNIT, risen) > -Infinity;
  };
  let startEdge = -1;
  for (let d = 0; d <= pad; d += 0.25) if (inside(d)) startEdge = d;
  let endEdge = path.length + 1;
  for (let d = path.length; d >= path.length - pad; d -= 0.25) if (inside(d)) endEdge = d;
  // the whole footprint run touching that edge is excused
  while (startEdge >= 0 && startEdge < path.length && inside(startEdge + 0.25)) startEdge += 0.25;
  while (endEdge <= path.length && endEdge > 0 && inside(endEdge - 0.25)) endEdge -= 0.25;
  return (d) => d <= startEdge + 0.25 || d >= endEdge - 0.25;
}
const feetAt = (path: Polyline, d: number, lift: number): { x: number; z: number; y: number } => {
  const [wx, wy] = sampleAt(path, d).point;
  const x = (wx - HALF) * UNIT;
  const z = (wy - HALF) * UNIT;
  return { x, z, y: groundHeightAt(x, z) + lift };
};

describe('bridge hops (T45.3)', { timeout: 120_000 }, () => {
  for (const level of LEVELS) {
    it(`Walks_(${level}RisenBridges)_Should_ClearDeckAndParapetsAndEndOnTheirSquare`, () => {
      const risen = risenOn(level);
      let hopped = 0;
      for (const { squares, path } of ALL_WALKS) {
        for (const hero of HEROES) {
          for (const fast of [false, true]) {
            const gait = gaitFor(squares.length, fast);
            const plan = planHops(path, risen, hero, gait, fast, gait.cycle);
            hopped += plan.hops.length;
            const resting = restingRuns(path, risen);
            const label = `${level} ${hero} ${squares.join('>')} fast=${fast}`;
            for (let ms = 0; ms <= plan.totalMs; ms += 5) {
              const s = sampleHopWalk(plan, path.length, gait, fast, ms);
              const feet = feetAt(path, s.d, s.lift);
              const need = requiredHeightAt(feet.x, feet.z, risen);
              if (need > -Infinity && !resting(s.d)) expect(feet.y, label).toBeGreaterThanOrEqual(need - 1e-9);
            }
            const end = sampleHopWalk(plan, path.length, gait, fast, plan.totalMs);
            expect(end.d, label).toBeCloseTo(path.length, 6);
            expect(end.lift, label).toBe(0);
            expect(end.leap, label).toBeNull();
            const [ex, ey] = sampleAt(path, end.d).point;
            const last = path.points[path.points.length - 1]!;
            expect(ex, label).toBeCloseTo(last[0], 6);
            expect(ey, label).toBeCloseTo(last[1], 6);
          }
        }
      }
      expect(hopped).toBeGreaterThan(0);
    });
  }

  it('Hops_(Landing)_Should_TouchDownOnThePathAtGroundLevel', () => {
    const risen = risenOn('easy');
    for (const { squares, path } of ALL_WALKS) {
      const gait = gaitFor(squares.length, false);
      const plan = planHops(path, risen, 'rama', gait, false, gait.cycle);
      plan.hops.forEach((hop) => {
        expect(hop.d0).toBeGreaterThanOrEqual(0);
        expect(hop.d1).toBeLessThanOrEqual(path.length + 1e-9);
      });
      // every leap sample is airborne over the path and the first walking sample after it has no lift
      let previous = sampleHopWalk(plan, path.length, gait, false, 0);
      for (let ms = 1; ms <= plan.totalMs; ms += 1) {
        const s = sampleHopWalk(plan, path.length, gait, false, ms);
        if (previous.leap && !s.leap) expect(s.lift).toBe(0);
        expect(s.d).toBeGreaterThanOrEqual(previous.d - 1e-9);
        previous = s;
      }
    }
  });

  it('Hop_(NormalSpeed)_Should_TakeAtMostHalfASecondAndFastHalveIt', () => {
    for (const hero of HEROES) {
      expect(hopMsFor(hero, false)).toBeLessThanOrEqual(500);
      expect(hopMsFor(hero, true)).toBe(hopMsFor(hero, false) / 2);
    }
    expect(hopMsFor('hanuman', false)).toBeGreaterThan(hopMsFor('rama', false));
    const risen = risenOn('easy');
    for (const { squares, path } of ALL_WALKS) {
      const gait = gaitFor(squares.length, false);
      for (const hop of planHops(path, risen, 'hanuman', gait, false, gait.cycle).hops) {
        expect(hop.ms).toBeLessThanOrEqual(500);
        expect(hop.beats.reduce((a, b) => a + b, 0)).toBeCloseTo(hop.ms, 6);
      }
    }
  });

  it('Hops_(HiddenBridges)_Should_NeverCauseAHop', () => {
    for (const { squares, path } of ALL_WALKS) {
      const gait = gaitFor(squares.length, false);
      const plan = planHops(path, [], 'hanuman', gait, false, gait.cycle);
      expect(plan.hops).toHaveLength(0);
      const s = sampleHopWalk(plan, path.length, gait, false, plan.totalMs / 2);
      expect(s.leap).toBeNull();
      expect(s.lift).toBe(0);
    }
  });

  it('Hops_(TwoCloseBridges)_Should_MergeIntoOneLongerHop', () => {
    const risen = risenOn('easy');
    for (const { squares, path } of ALL_WALKS) {
      const gait = gaitFor(squares.length, false);
      const { hops } = planHops(path, risen, 'rama', gait, false, gait.cycle);
      hops.forEach((hop, i) => {
        if (i > 0) expect(hop.d0 - hops[i - 1]!.d1).toBeGreaterThanOrEqual(gait.cycle);
      });
      const loose = planHops(path, risen, 'rama', gait, false, 0).hops;
      const closePair = loose.some((hop, i) => i > 0 && hop.d0 - loose[i - 1]!.d1 < gait.cycle);
      if (closePair) expect(hops.length).toBeLessThan(loose.length);
    }
  });

  it('Hops_(ReducedMotionGlide)_Should_LiftOverTheBridgeWithoutALeap', () => {
    const risen = risenOn('easy');
    for (const { squares, path } of ALL_WALKS) {
      const gait = gaitFor(3, false);
      const plan = planHops(path, risen, 'rama', gait, false, gait.cycle);
      const resting = restingRuns(path, risen);
      for (let d = 0; d <= path.length; d += 0.5) {
        if (resting(d)) continue;
        const feet = feetAt(path, d, glideLift(plan, d));
        const need = requiredHeightAt(feet.x, feet.z, risen);
        if (need > -Infinity) expect(feet.y, squares.join('>')).toBeGreaterThanOrEqual(need - 1e-9);
      }
    }
  });

  it('Clearance_(Constant)_Should_BeAtLeastSixHundredthsOfAUnit', () => {
    expect(HOP_CLEARANCE).toBeGreaterThanOrEqual(0.06);
  });
});
