import { describe, expect, it } from 'vitest';
import {
  LONG_LEAP_BEATS,
  LONG_LEAP_BEATS_FAST,
  LONG_LEAP_CLEARANCE,
  STEP_BEATS,
  STEP_BEATS_FAST,
  crossingMs,
  crossingPlan,
  hopHeight,
  leapProgress,
  type CrossingInput,
} from '../src/app/board3d/crossing';

const base: CrossingInput = { id: 'vishwamitra', hero: 'rama', length: 3.25, apexRise: 0.9, fast: false };

describe('bridge crossing plan (T44 6.5)', () => {
  it('Crossing_(LongBridge)_Should_LeapOnRunTheDeckAndLeapOff', () => {
    const plan = crossingPlan(base);
    expect(plan.map((s) => s.kind)).toEqual(['leap', 'run', 'leap']);
    expect(plan[0]!.t0).toBe(0);
    expect(plan[2]!.t1).toBe(1);
    expect(plan[0]!.t1).toBeCloseTo(plan[1]!.t0);
    expect(plan[1]!.t1).toBeCloseTo(plan[2]!.t0);
  });

  it('Crossing_(DeckRun)_Should_RunAtFiveUnitsPerSecondAndTenInFast', () => {
    expect(crossingPlan(base)[1]!.ms).toBeCloseTo((3.25 / 5) * 1000);
    expect(crossingPlan({ ...base, fast: true })[1]!.ms).toBeCloseTo((3.25 / 10) * 1000);
  });

  it('Crossing_(StepLeaps)_Should_UseTheT43BeatsAndTheShorterFastBeats', () => {
    expect(crossingPlan(base)[0]).toMatchObject({ beats: STEP_BEATS, ms: 540 });
    expect(crossingPlan({ ...base, fast: true })[2]).toMatchObject({ beats: STEP_BEATS_FAST, ms: 240 });
  });

  it('Crossing_(ShortBridgeLikeShabari)_Should_BeOneLeapFromFootToTop', () => {
    const plan = crossingPlan({ ...base, id: 'shabari', length: 0.27 });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'leap', t0: 0, t1: 1 });
  });

  it('Crossing_(HanumanOnHanumanLeap)_Should_BeOneLongLeapClearingTheDeckApex', () => {
    const plan = crossingPlan({ ...base, id: 'hanuman-leap', hero: 'hanuman', length: 2.27 });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ kind: 'leap', t0: 0, t1: 1, beats: LONG_LEAP_BEATS });
    expect(plan[0]!.kind === 'leap' && plan[0]!.hop).toBeCloseTo(0.9 + LONG_LEAP_CLEARANCE);
    const fast = crossingPlan({ ...base, id: 'hanuman-leap', hero: 'hanuman', length: 2.27, fast: true });
    expect(fast[0]).toMatchObject({ beats: LONG_LEAP_BEATS_FAST });
    expect(crossingMs(fast)).toBeLessThan(crossingMs(plan));
  });

  it('Crossing_(OtherHeroesOnHanumanLeap)_Should_RunTheDeck', () => {
    const plan = crossingPlan({ ...base, id: 'hanuman-leap', hero: 'sita', length: 2.27 });
    expect(plan.map((s) => s.kind)).toEqual(['leap', 'run', 'leap']);
  });

  it('LeapProgress_(Beats)_Should_HoldThroughAnticipationAndLandBeforeTheLastBeat', () => {
    expect(leapProgress(100, STEP_BEATS)).toBe(0);
    expect(leapProgress(160 + 130, STEP_BEATS)).toBeCloseTo(0.5);
    expect(leapProgress(160 + 260, STEP_BEATS)).toBe(1);
    expect(leapProgress(530, STEP_BEATS)).toBe(1);
  });

  it('HopHeight_(Leap)_Should_PeakAtMidFlightAndBeZeroAtBothEnds', () => {
    expect(hopHeight(0, 0.14)).toBe(0);
    expect(hopHeight(1, 0.14)).toBe(0);
    expect(hopHeight(0.5, 0.14)).toBeCloseTo(0.14);
  });
});
