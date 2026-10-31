import { describe, expect, it } from 'vitest';
import { fieldCentre } from '../src/game/iso/boardIso';
import {
  distanceAt,
  durationOf,
  facingOf,
  frameIndexOf,
  gaitFor,
  leapFrameOf,
  leapPhaseAt,
  pathOf,
  phaseAt,
  sampleAt,
  stepLeapBeats,
  type Facing,
} from '../src/game/iso/locomotion';

const SQUARE = 56;

/** A move of `n` squares that starts and ends on field centres: n x 56 units. */
const lengthOf = (n: number) => n * SQUARE;

describe('facingOf (spec 2)', () => {
  it('MoveAlongPlusX_Should_FaceSE', () => expect(facingOf([56, 0], 'SW')).toBe('SE'));
  it('MoveAlongMinusX_Should_FaceNW', () => expect(facingOf([-56, 0], 'SE')).toBe('NW'));
  it('MoveAlongMinusY_Should_FaceNE', () => expect(facingOf([0, -56], 'SE')).toBe('NE'));
  it('MoveAlongPlusY_Should_FaceSW', () => expect(facingOf([0, 56], 'SE')).toBe('SW'));

  it('MoveOnTheDiagonal_(Tie)_Should_KeepThePreviousFacing', () => {
    expect(facingOf([40, -40], 'SE')).toBe('SE');
    expect(facingOf([40, -40], 'NE')).toBe('NE');
    expect(facingOf([-30, 30], 'NW')).toBe('NW');
  });

  it('NoMove_Should_KeepThePreviousFacing', () => expect(facingOf([0, 0], 'NW')).toBe('NW'));
});

describe('gaitFor (spec 4)', () => {
  it('OneAndTwoSquares_Should_Walk80UnitsPerSecond', () => {
    for (const n of [1, 2])
      expect(gaitFor(n, false)).toMatchObject({ clip: 'walk', speed: 80, cycle: 32, frames: 8 });
  });

  it('ThreeSquaresOrMore_Should_Run280UnitsPerSecond', () => {
    for (const n of [3, 4, 6])
      expect(gaitFor(n, false)).toMatchObject({ clip: 'run', speed: 280, cycle: 56, frames: 6 });
  });

  it('FastMode_(Any_Distance)_Should_Run560UnitsPerSecond', () => {
    for (const n of [1, 2, 3, 6]) expect(gaitFor(n, true)).toMatchObject({ clip: 'run', speed: 560 });
  });
});

describe('durationOf (spec 4)', () => {
  const ms = (squares: number, fast = false) => durationOf(lengthOf(squares), gaitFor(squares, fast), fast);

  it('WalkOneSquare_Should_Take820Ms', () => expect(ms(1)).toBeCloseTo(820, 0));
  it('WalkTwoSquares_Should_Take1520Ms', () => expect(ms(2)).toBeCloseTo(1520, 0));
  it('RunThreeSquares_Should_Take700Ms', () => expect(ms(3)).toBeCloseTo(700, 0));
  it('RunSixSquares_Should_Take1300Ms', () => expect(ms(6)).toBeCloseTo(1300, 0));
  it('FastSixSquares_Should_Take600Ms', () => expect(ms(6, true)).toBeCloseTo(600, 0));
  it('FastOneSquare_Should_Take100Ms', () => expect(ms(1, true)).toBeCloseTo(100, 0));
});

describe('distanceAt (speed profile)', () => {
  const cases = [
    ['Walk', 2, false],
    ['Run', 6, false],
    ['FastRun', 6, true],
  ] as const;

  for (const [name, squares, fast] of cases) {
    const gait = gaitFor(squares, fast);
    const length = lengthOf(squares);

    it(`${name}_Should_StartAtZeroAndEndAtTheLength`, () => {
      expect(distanceAt(0, length, gait, fast)).toBe(0);
      expect(distanceAt(1, length, gait, fast)).toBeCloseTo(length, 6);
    });

    it(`${name}_Should_NeverGoBackwards`, () => {
      let previous = -1;
      for (let i = 0; i <= 1000; i++) {
        const d = distanceAt(i / 1000, length, gait, fast);
        expect(d, `u ${i / 1000}`).toBeGreaterThanOrEqual(previous);
        previous = d;
      }
    });
  }

  it('Run_Should_EaseInOver12UnitsAndOutOverTheLast16', () => {
    const gait = gaitFor(6, false);
    const length = lengthOf(6);
    const total = durationOf(length, gait, false);
    // Ease-in at constant acceleration: 12 units take 2 x 12 / 280 s; the ease-out takes 2 x 16 / 280 s.
    expect(distanceAt((((2 * 12) / 280) * 1000) / total, length, gait, false)).toBeCloseTo(12, 5);
    expect(distanceAt(1 - (((2 * 16) / 280) * 1000) / total, length, gait, false)).toBeCloseTo(
      length - 16,
      5,
    );
  });

  it('Run_Should_CruiseAt280UnitsPerSecondBetweenTheRamps', () => {
    const gait = gaitFor(6, false);
    const length = lengthOf(6);
    const total = durationOf(length, gait, false);
    const dt = 10 / total;
    const speed =
      ((distanceAt(0.5 + dt, length, gait, false) - distanceAt(0.5, length, gait, false)) / 10) * 1000;
    expect(speed).toBeCloseTo(280, 3);
  });
});

describe('pathOf and sampleAt', () => {
  it('ThreeSquaresAlongARow_Should_BeThreeSquaresLong', () => {
    const start = fieldCentre(1);
    const path = pathOf(start, [2, 3, 4], fieldCentre(4));
    expect(path.length).toBeCloseTo(3 * SQUARE, 6);
    expect(path.centreAt).toHaveLength(3);
    expect(path.centreAt[0]).toBeCloseTo(SQUARE, 6);
  });

  it('FanSlot_Should_BeBlendedInOverTheLast20Units', () => {
    const spot: [number, number] = [fieldCentre(3)[0] + 8, fieldCentre(3)[1] + 6];
    const path = pathOf(fieldCentre(1), [2, 3], spot);
    const end = sampleAt(path, path.length).point;
    expect(end[0]).toBeCloseTo(spot[0], 6);
    expect(end[1]).toBeCloseTo(spot[1], 6);
    const before = sampleAt(path, path.length - 40).point;
    expect(before[0]).toBeLessThan(fieldCentre(3)[0] - 20); // still on the row line, short of the blend
    expect(before[1]).toBeCloseTo(fieldCentre(3)[1], 3);
  });

  it('RowEnd_(11_12_13_14)_Should_TurnSEThenNEThenNWAtTheSquareCentres', () => {
    const path = pathOf(fieldCentre(10), [11, 12, 13, 14], fieldCentre(14));
    let facing: Facing = 'SW';
    const seen: Facing[] = [];
    for (let d = 0; d <= path.length; d += 1) {
      facing = facingOf(sampleAt(path, d).dir, facing);
      if (seen[seen.length - 1] !== facing) seen.push(facing);
    }
    expect(seen).toEqual(['SE', 'NE', 'NW']);
    // the swap happens exactly at the centre of 12 (after two squares) and of 13 (after three)
    expect(facingOf(sampleAt(path, 2 * SQUARE - 0.01).dir, 'SE')).toBe('SE');
    expect(facingOf(sampleAt(path, 2 * SQUARE).dir, 'SE')).toBe('NE');
    expect(facingOf(sampleAt(path, 3 * SQUARE).dir, 'NE')).toBe('NW');
  });

  it('BounceAt144_Should_TurnRoundExactlyAtTheCentreOf144', () => {
    const path = pathOf(fieldCentre(142), [143, 144, 143, 142], fieldCentre(142));
    const turn = path.centreAt[1]!;
    const before = facingOf(sampleAt(path, turn - 0.01).dir, 'SW');
    const after = facingOf(sampleAt(path, turn).dir, before);
    expect(before).not.toBe(after);
    expect(new Set([before, after])).toEqual(new Set<Facing>(['NW', 'SE']));
  });

  it('PhaseAcrossARowEndBend_Should_BeContinuous', () => {
    const path = pathOf(fieldCentre(10), [11, 12, 13, 14], fieldCentre(14));
    const gait = gaitFor(4, false);
    const bend = path.centreAt[1]!;
    const step = 0.01;
    const raw = phaseAt(bend + step, gait.cycle) - phaseAt(bend - step, gait.cycle);
    const jump = ((raw % 1) + 1) % 1; // the cycle wraps: compare modulo one turn
    expect(jump).toBeCloseTo((2 * step) / gait.cycle, 9);
  });

  it('RevealIndex_Should_CountTheSquareCentresPassed', () => {
    const path = pathOf(fieldCentre(1), [2, 3, 4], fieldCentre(4));
    expect(sampleAt(path, 1).squareIndex).toBe(0);
    expect(sampleAt(path, SQUARE + 1).squareIndex).toBe(1);
    expect(sampleAt(path, 2 * SQUARE + 1).squareIndex).toBe(2);
  });
});

describe('distance-driven phase (spec 4, no sliding)', () => {
  it('FrameIndex_(Start_Of_Move)_Should_BeFrameZeroContact', () => {
    expect(frameIndexOf(phaseAt(0, 32), 8)).toBe(0);
    expect(frameIndexOf(phaseAt(0, 56), 6)).toBe(0);
  });
});

describe('leaps and bridge timelines (spec 3.1 and 4)', () => {
  it('LeapPhase_Should_StartEachBeatAtTheFrameThresholds', () => {
    const beats = stepLeapBeats(false);
    expect(leapFrameOf(leapPhaseAt(0, beats))).toBe(0);
    expect(leapFrameOf(leapPhaseAt(159, beats))).toBe(0);
    expect(leapFrameOf(leapPhaseAt(161, beats))).toBe(1);
    expect(leapFrameOf(leapPhaseAt(241, beats))).toBe(2);
    expect(leapFrameOf(leapPhaseAt(421, beats))).toBe(3);
    expect(leapFrameOf(leapPhaseAt(540, beats))).toBe(3);
  });
});
