import { describe, expect, it } from 'vitest';
import { distanceAt, durationOf, gaitFor } from '../src/game/iso/locomotion';
import {
  RUN_SPEED,
  STILL_SPEED,
  STOP_HOLD_MS,
  HeroDirector,
  type TokenSample,
} from '../src/app/board3d/heroDirector';

const FRAME_MS = 16;

function sample(over: Partial<TokenSample> & Pick<TokenSample, 'spot'>): TokenSample {
  return { scale: 1, onBridge: false, emotion: null, ...over };
}

/** A token moving along +x at `speed` world units/s for `ms`, one director update per frame. */
function walkFor(
  director: HeroDirector,
  speed: number,
  ms: number,
  x0 = 0,
  extra: Partial<TokenSample> = {},
) {
  let x = x0;
  let last = director.update(0, sample({ spot: [x, 0], ...extra }));
  for (let t = 0; t < ms; t += FRAME_MS) {
    x += (speed * FRAME_MS) / 1000;
    last = director.update(FRAME_MS, sample({ spot: [x, 0], ...extra }));
  }
  return { last, x };
}

/** The clip per 16 ms frame of a real DioramaView move: distanceAt over the gait's own ease-in and ease-out. */
function moveClips(squares: number, fast: boolean): string[] {
  const gait = gaitFor(squares, fast);
  const length = squares * 56;
  const duration = durationOf(length, gait, fast);
  const director = new HeroDirector();
  director.update(0, sample({ spot: [0, 0] }));
  const clips: string[] = [];
  for (let t = FRAME_MS; t <= duration; t += FRAME_MS) {
    const x = distanceAt(t / duration, length, gait, fast);
    clips.push(director.update(FRAME_MS, sample({ spot: [x, 0] })).clip);
  }
  return clips;
}

describe('HeroDirector: which clip a token plays', () => {
  it('Token_(Standing)_ShouldPlayIdle', () => {
    const director = new HeroDirector();
    const { last } = walkFor(director, 0, 200);
    expect(last.clip).toBe('idle');
    expect(last.moving).toBe(false);
  });

  it('Token_(WalkingAtEightyUnitsPerSecond)_ShouldPlayWalk', () => {
    const { last } = walkFor(new HeroDirector(), 80, 400);
    expect(last.clip).toBe('walk');
    expect(last.moving).toBe(true);
  });

  it('Token_(RunningAtTwoEightyOrFastFiveSixty)_ShouldPlayRun', () => {
    expect(walkFor(new HeroDirector(), 280, 300).last.clip).toBe('run');
    expect(walkFor(new HeroDirector(), 560, 300).last.clip).toBe('run');
  });

  it('Gait_(TwoSquares)_ShouldWalkTheWholeMove', () => {
    const clips = moveClips(2, false);
    expect(clips.slice(2, -6).every((c) => c === 'walk')).toBe(true);
  });

  it('Gait_(ThreeAndSixSquaresEasingInFromZero)_ShouldRunWithinTheFirstSixFramesAndToTheEnd', () => {
    for (const squares of [3, 6]) {
      const clips = moveClips(squares, false);
      expect(clips.slice(0, 6), `${squares} squares`).toContain('run');
      const firstRun = clips.indexOf('run');
      expect(
        clips.slice(firstRun, -4).every((c) => c === 'run'),
        `${squares} squares`,
      ).toBe(true);
      expect(clips.slice(firstRun).includes('walk'), `${squares} squares never walks after the cut`).toBe(
        false,
      );
    }
  });

  it('Gait_(Fast)_ShouldRunFromTheFirstFrame', () => {
    const clips = moveClips(6, true);
    expect(clips[0]).toBe('run');
    expect(clips.slice(0, -2).every((c) => c === 'run')).toBe(true);
  });

  it('Gait_(RunThatStartedAsWalk)_ShouldCutToRunWithinFiveWorldUnitsOfTheStart', () => {
    const gait = gaitFor(3, false);
    const length = 3 * 56;
    const duration = durationOf(length, gait, false);
    const director = new HeroDirector();
    director.update(0, sample({ spot: [0, 0] }));
    let walked = 0;
    for (let t = FRAME_MS; t <= duration; t += FRAME_MS) {
      const x = distanceAt(t / duration, length, gait, false);
      if (director.update(FRAME_MS, sample({ spot: [x, 0] })).clip === 'run') break;
      walked = x;
    }
    expect(walked).toBeLessThan(5);
  });

  it('Gait_(StartedWithAWalk)_ShouldBecomeARunOnceTheSpeedPassesTheRunThreshold', () => {
    const director = new HeroDirector();
    walkFor(director, 60, 200);
    const { last } = walkFor(director, 300, 200, 100);
    expect(last.clip).toBe('run');
  });

  it('Gait_(RunSlowingDownAtTheEnd)_ShouldKeepRunningNotFlipBackToWalk', () => {
    const director = new HeroDirector();
    walkFor(director, 280, 300);
    const { last } = walkFor(director, 60, 100, 300);
    expect(last.clip).toBe('run');
  });

  it('Gait_(StopsFor90Ms)_ShouldEndTheMoveAndResetTheDistance', () => {
    const director = new HeroDirector();
    const moved = walkFor(director, 80, 500);
    expect(moved.last.distance).toBeGreaterThan(30);
    let last = moved.last;
    for (let t = 0; t < STOP_HOLD_MS + 2 * FRAME_MS; t += FRAME_MS) {
      last = director.update(FRAME_MS, sample({ spot: [moved.x, 0] }));
    }
    expect(last.moving).toBe(false);
    expect(last.clip).toBe('idle');
    expect(last.distance).toBe(0);
  });

  it('Gait_(ArrivalSquashShorterThanTheHold)_ShouldNotCutTheWalkShort', () => {
    const director = new HeroDirector();
    const moved = walkFor(director, 80, 300);
    const still = director.update(60, sample({ spot: [moved.x, 0] })); // the 60 ms squash at arrival
    expect(still.moving).toBe(true);
  });

  it('Distance_(Walk)_ShouldAddUpEveryStepSoThePhaseNeverResets', () => {
    const director = new HeroDirector();
    const { last, x } = walkFor(director, 80, 1000);
    expect(last.distance).toBeCloseTo(x, 3);
  });

  it('Direction_(MovingSouthEast)_ShouldBeTheUnitMoveVector', () => {
    const { last } = walkFor(new HeroDirector(), 80, 100);
    expect(last.dir[0]).toBeCloseTo(1, 6);
    expect(last.dir[1]).toBeCloseTo(0, 6);
  });

  it('Token_(OnABridgeArch)_ShouldRunEvenWhenSlow', () => {
    const { last } = walkFor(new HeroDirector(), 10, 100, 0, { onBridge: true });
    expect(last.clip).toBe('run');
  });

  it('Token_(SlidingBack)_ShouldStayIdleWithNoStepsAndNoDistance', () => {
    const { last } = walkFor(new HeroDirector(), 400, 300, 0, { glide: true });
    expect(last.clip).toBe('idle');
    expect(last.distance).toBe(0);
  });

  it('Token_(BittenAndShrinking)_ShouldHoldTheScaredPose', () => {
    const director = new HeroDirector();
    walkFor(director, 0, 100);
    const last = director.update(FRAME_MS, sample({ spot: [0, 0], scale: 0.6, emotion: 'scared' }));
    expect(last.clip).toBe('scared');
  });

  it('Mood_(WithTween)_ShouldPlayTheTweensClip', () => {
    const director = new HeroDirector();
    const last = director.update(
      FRAME_MS,
      sample({ spot: [0, 0], emotion: 'excited', reaction: { tween: 'leap', emotion: 'excited' } }),
    );
    expect(last.clip).toBe('excited');
    expect(last.emotion).toBe('excited');
  });

  it('Mood_(EmotionOnly)_ShouldPlayTheMatchingRestPose', () => {
    const director = new HeroDirector();
    for (const emotion of ['happy', 'excited', 'scared', 'sad'] as const) {
      expect(director.update(FRAME_MS, sample({ spot: [0, 0], emotion })).clip).toBe(emotion);
    }
    expect(director.update(FRAME_MS, sample({ spot: [0, 0], emotion: 'idle' })).clip).toBe('idle');
  });

  it('Mood_(WhileWalking)_ShouldNotInterruptTheGait', () => {
    const { last } = walkFor(new HeroDirector(), 80, 300, 0, { emotion: 'happy' });
    expect(last.clip).toBe('walk');
    expect(last.emotion).toBe('happy');
  });

  it('Entry_(ArcOrTripleSixSlideFlaggedGlide)_ShouldNeverFreezeAGaitPoseOnIt', () => {
    const director = new HeroDirector();
    walkFor(director, 280, 100); // a run in progress, then the token is flagged as sliding
    const { last } = walkFor(director, 400, 100, 100, { glide: true });
    expect(last.clip).toBe('idle');
    expect(last.moving).toBe(false);
  });

  it('Win_(WonFlagOnTheWinScreen)_ShouldCheer', () => {
    const last = new HeroDirector().update(FRAME_MS, sample({ spot: [0, 0], won: true }));
    expect(last.clip).toBe('cheer');
  });

  it('Thresholds_(WalkRunStill)_ShouldSeparateTheLocomotionSpeeds', () => {
    expect(STILL_SPEED).toBeLessThan(80);
    expect(RUN_SPEED).toBeGreaterThan(80);
    expect(RUN_SPEED).toBeLessThan(280);
  });
});
