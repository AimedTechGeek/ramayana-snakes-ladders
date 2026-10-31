import { describe, expect, it } from 'vitest';
import table from '../src/characters/reactions.json';
import type { Hero } from '../src/core/types';
import {
  reactionFor,
  type Emotion,
  type ReactionEvent,
  type Role,
  type TweenName,
} from '../src/characters/reactions';
import { gaitFor, leapPhaseAt, phaseAt, stepLeapBeats, longLeapBeats } from '../src/game/iso/locomotion';
import {
  CLIP_FRAMES,
  FACE_FRAMES,
  HERO_CLIPS,
  LEAP_BANDS,
  angleDelta,
  axisYawOf,
  clipForTween,
  clipSeconds,
  clipTimeAtPhase,
  clipWeight,
  easeYaw,
  fadeBetween,
  faceFrameOf,
  isDistanceDriven,
  isLooping,
  leapClipTime,
  nextBlinkInMs,
  phaseFromDistance,
  yawOfMove,
} from '../src/app/board3d/heroClips';
import { clipForReaction } from '../src/app/board3d/heroDirector';

const HERO_IDS = Object.keys(table).filter((key) => key !== 'timing') as Hero[];
const ROLES: Role[] = ['self', 'other'];

const TWEENS: TweenName[] = [
  'none',
  'bounce',
  'leap',
  'somersault',
  'cower',
  'shake',
  'slump',
  'nod',
  'clap',
  'stomp',
  'fidget',
  'bless',
  'salute',
  'sigh',
];

describe('The nine hero clips', () => {
  it('Clip_(List)_ShouldBeExactlyTheNineOfTheSpec', () => {
    expect([...HERO_CLIPS].sort()).toEqual(
      ['cheer', 'excited', 'happy', 'idle', 'leap', 'run', 'sad', 'scared', 'walk'].sort(),
    );
  });

  it('Clip_(Frames)_ShouldGiveTheDurationsOfT44Section4_5At24Fps', () => {
    expect(CLIP_FRAMES).toEqual({
      idle: 48,
      walk: 24,
      run: 16,
      leap: 22,
      happy: 36,
      excited: 36,
      scared: 30,
      sad: 36,
      cheer: 60,
    });
    expect(clipSeconds('idle')).toBeCloseTo(2.0, 5);
    expect(clipSeconds('walk')).toBeCloseTo(1.0, 5);
    expect(clipSeconds('run')).toBeCloseTo(0.667, 3);
    expect(clipSeconds('leap')).toBeCloseTo(0.917, 3);
    expect(clipSeconds('scared')).toBeCloseTo(1.25, 5);
    expect(clipSeconds('cheer')).toBeCloseTo(2.5, 5);
  });

  it('Clip_(Loop)_ShouldRepeatIdleWalkRunCheerAndPlayTheRestOnce', () => {
    expect(HERO_CLIPS.filter(isLooping).sort()).toEqual(['cheer', 'idle', 'run', 'walk']);
  });

  it('Clip_(Driven)_ShouldBeByDistanceOnlyForWalkAndRun', () => {
    expect(HERO_CLIPS.filter(isDistanceDriven).sort()).toEqual(['run', 'walk']);
  });
});

describe('Tween and emotion to clip (T44 4.6)', () => {
  it('Tween_(BounceClapNodBlessSalute)_ShouldPlayHappy', () => {
    for (const tween of ['bounce', 'clap', 'nod', 'bless', 'salute'] as const) {
      expect(clipForTween(tween, 'idle')).toBe('happy');
    }
  });

  it('Tween_(LeapSomersault)_ShouldPlayExcited', () => {
    expect(clipForTween('leap', 'excited')).toBe('excited');
    expect(clipForTween('somersault', 'excited')).toBe('excited');
  });

  it('Tween_(CowerShake)_ShouldPlayScared', () => {
    expect(clipForTween('cower', 'scared')).toBe('scared');
    expect(clipForTween('shake', 'scared')).toBe('scared');
  });

  it('Tween_(SlumpSighFidget)_ShouldPlaySad', () => {
    for (const tween of ['slump', 'sigh', 'fidget'] as const) expect(clipForTween(tween, 'sad')).toBe('sad');
  });

  it('Tween_(StompPositive)_ShouldPlayExcitedAndStompNegativeSad', () => {
    expect(clipForTween('stomp', 'happy')).toBe('excited');
    expect(clipForTween('stomp', 'excited')).toBe('excited');
    expect(clipForTween('stomp', 'sad')).toBe('sad');
    expect(clipForTween('stomp', 'scared')).toBe('sad');
  });

  it('Tween_(None)_ShouldStayIdle', () => {
    expect(clipForTween('none', 'happy')).toBe('idle');
  });

  it('Tween_(EveryT05Name)_ShouldMapToAClipTheGlbHas', () => {
    for (const tween of TWEENS) {
      for (const emotion of ['idle', 'happy', 'excited', 'scared', 'sad'] as Emotion[]) {
        expect(HERO_CLIPS).toContain(clipForTween(tween, emotion));
      }
    }
  });

  it('Reaction_(EveryHeroRoleEvent)_ShouldPickAClipFromItsTween', () => {
    let checked = 0;
    for (const hero of HERO_IDS) {
      for (const role of ROLES) {
        for (const event of Object.keys(table[hero][role]) as ReactionEvent[]) {
          const reaction = reactionFor(hero, role, event);
          expect(HERO_CLIPS).toContain(clipForReaction(reaction));
          expect(clipForReaction(reaction)).toBe(clipForTween(reaction.tween, reaction.emotion));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('Weight_(Intensity)_ShouldBeHalfPlusHalfIntensityAndStayInRange', () => {
    expect(clipWeight(0)).toBe(0.5);
    expect(clipWeight(1)).toBe(1);
    expect(clipWeight(0.6)).toBeCloseTo(0.8, 5);
    expect(clipWeight(2)).toBe(1);
    expect(clipWeight(-1)).toBe(0.5);
  });

  it('Crossfade_(WalkRun)_ShouldNeverBlendButEverythingElseShouldFade150Ms', () => {
    expect(fadeBetween('walk', 'run')).toBe(0);
    expect(fadeBetween('run', 'walk')).toBe(0);
    expect(fadeBetween('idle', 'walk')).toBe(150);
    expect(fadeBetween('walk', 'idle')).toBe(150);
    expect(fadeBetween('happy', 'idle')).toBe(150);
    expect(fadeBetween(null, 'run')).toBe(150);
  });
});

describe('Face frames', () => {
  it('Face_(Emotion)_ShouldPickItsAtlasColumn', () => {
    expect(FACE_FRAMES).toEqual(['idle', 'blink', 'happy', 'excited', 'scared', 'sad']);
    expect(faceFrameOf('idle', false)).toBe(0);
    expect(faceFrameOf('happy', false)).toBe(2);
    expect(faceFrameOf('excited', false)).toBe(3);
    expect(faceFrameOf('scared', false)).toBe(4);
    expect(faceFrameOf('sad', false)).toBe(5);
  });

  it('Face_(Blink)_ShouldOnlyShowAtIdle', () => {
    expect(faceFrameOf('idle', true)).toBe(1);
    expect(faceFrameOf('happy', true)).toBe(2);
    expect(faceFrameOf('scared', true)).toBe(4);
  });

  it('Blink_(Interval)_ShouldBeThreeToFiveSeconds', () => {
    expect(nextBlinkInMs(0)).toBe(3000);
    expect(nextBlinkInMs(0.999)).toBeLessThan(5000);
    expect(nextBlinkInMs(0.5)).toBe(4000);
  });
});

describe('Distance-driven phase (the feet must not slide)', () => {
  it('Phase_(ZeroDistance)_ShouldStartOnTheContactFrame', () => {
    expect(phaseFromDistance(0, 32 / 56)).toBe(0);
    expect(clipTimeAtPhase('walk', 0)).toBe(0);
  });

  it('Phase_(OneCycleOfDistance)_ShouldWrapToTheSameContact', () => {
    expect(phaseFromDistance(32 / 56, 32 / 56)).toBeCloseTo(0, 9);
    expect(phaseFromDistance(3 * (56 / 56) + 0.25, 56 / 56)).toBeCloseTo(0.25, 9);
  });

  it('Phase_(HalfCycle)_ShouldBeTheOtherFootContactAtClipFrame12', () => {
    const phase = phaseFromDistance(16 / 56, 32 / 56);
    expect(phase).toBeCloseTo(0.5, 9);
    expect(clipTimeAtPhase('walk', phase) * 24).toBeCloseTo(12, 6);
  });

  it('Phase_(BoardUnits)_ShouldEqualTheLocomotionPhaseOfWorldUnits', () => {
    // DioramaView samples phaseAt(walkedWorldUnits, gait.cycle); the Hero divides board units by the GLB stride
    for (const squares of [1, 2, 3, 6]) {
      const gait = gaitFor(squares, false);
      for (const walked of [0, 7, 16, 31.9, 32, 77.3, 160, 559]) {
        expect(phaseFromDistance(walked / 56, gait.cycle / 56)).toBeCloseTo(phaseAt(walked, gait.cycle), 9);
      }
    }
  });

  it('Phase_(FootSpeed)_ShouldMatchGroundSpeedAtAnyMoveSpeed', () => {
    // clip time advance per unit of distance is constant: the foot moves back one stride per cycle however fast we go
    const cycle = 32 / 56;
    const secondsPerUnit = clipSeconds('walk') / cycle;
    for (const speed of [0.3, 1.43, 5, 10]) {
      const dt = 0.01;
      const d0 = 0.4;
      const t0 = clipTimeAtPhase('walk', phaseFromDistance(d0, cycle));
      const t1 = clipTimeAtPhase('walk', phaseFromDistance(d0 + speed * dt, cycle));
      let dtClip = t1 - t0;
      if (dtClip < 0) dtClip += clipSeconds('walk');
      expect(dtClip).toBeCloseTo(speed * dt * secondsPerUnit, 6);
    }
  });
});

describe('Leap beats to clip time', () => {
  const beats = stepLeapBeats(false);
  const [a, t, f, l] = beats;

  it('Leap_(Start)_ShouldBeFrameZero', () => {
    expect(leapClipTime(0, beats)).toBe(0);
  });

  it('Leap_(EachBeatEnd)_ShouldLandOnItsBandOfFrames', () => {
    expect(leapClipTime(a, beats) * 24).toBeCloseTo(LEAP_BANDS[1], 6);
    expect(leapClipTime(a + t, beats) * 24).toBeCloseTo(LEAP_BANDS[2], 6);
    expect(leapClipTime(a + t + f, beats) * 24).toBeCloseTo(LEAP_BANDS[3], 6);
    expect(leapClipTime(a + t + f + l, beats) * 24).toBeCloseTo(LEAP_BANDS[4], 6);
  });

  it('Leap_(Flight)_ShouldStretchTenFramesOverTheFlightTime', () => {
    const quarter = leapClipTime(a + t + f / 2, beats) * 24;
    expect(quarter).toBeCloseTo(11, 6);
    const longBeats = longLeapBeats(false);
    const mid = leapClipTime(longBeats[0] + longBeats[1] + longBeats[2] / 2, longBeats) * 24;
    expect(mid).toBeCloseTo(11, 6);
  });

  it('Leap_(FastBeats)_ShouldUseTheSameFrameBands', () => {
    const fast = stepLeapBeats(true);
    expect(leapClipTime(fast[0], fast) * 24).toBeCloseTo(4, 6);
    expect(leapClipTime(fast[0] + fast[1] + fast[2], fast) * 24).toBeCloseTo(16, 6);
  });

  it('Leap_(PastTheEnd)_ShouldStayOnTheLastFrame', () => {
    expect(leapClipTime(99999, beats) * 24).toBeCloseTo(22, 6);
  });

  it('Leap_(Time)_ShouldNeverGoBackwards', () => {
    let last = -1;
    for (let ms = 0; ms <= 600; ms += 5) {
      const now = leapClipTime(ms, beats);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
    // sanity against the sprite-era phase: both are monotone over the same beats
    expect(leapPhaseAt(600, beats)).toBeGreaterThan(leapPhaseAt(0, beats));
  });
});

describe('Facing', () => {
  it('Yaw_(MoveVector)_ShouldBeAtan2OfXAndYLikeDioramaView', () => {
    expect(yawOfMove([0, 1], 0.3)).toBeCloseTo(0, 9); // toward the viewer
    expect(yawOfMove([1, 0], 0.3)).toBeCloseTo(Math.PI / 2, 9);
    expect(yawOfMove([-1, 0], 0.3)).toBeCloseTo(-Math.PI / 2, 9);
    expect(yawOfMove([0, -1], 0.3)).toBeCloseTo(Math.PI, 9);
  });

  it('Yaw_(NoMove)_ShouldKeepThePreviousHeading', () => {
    expect(yawOfMove([0, 0], 1.25)).toBe(1.25);
  });

  it('Facing_(Axis)_ShouldReuseTheLocomotionRulesAndTieKeepPrevious', () => {
    expect(axisYawOf([1, 0.2], 'SW')).toEqual({ facing: 'SE', yaw: Math.PI / 2 });
    expect(axisYawOf([-1, 0.1], 'SW')).toEqual({ facing: 'NW', yaw: -Math.PI / 2 });
    expect(axisYawOf([0, -1], 'SW')).toEqual({ facing: 'NE', yaw: Math.PI });
    expect(axisYawOf([1, 1], 'SE').facing).toBe('SE');
    expect(axisYawOf([1, 1], 'SW').facing).toBe('SW');
    expect(axisYawOf([0, 0], 'NW').facing).toBe('NW');
  });

  it('Angle_(Delta)_ShouldTakeTheShortWayRoundTheCircle', () => {
    expect(angleDelta(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6, 9);
    expect(angleDelta(-3.0, 3.0)).toBeCloseTo(6 - 2 * Math.PI, 9);
    expect(angleDelta(0.5, 0.9)).toBeCloseTo(0.4, 9);
  });

  it('Yaw_(NinetyDegreeBend)_ShouldTurnSmoothlyWithin120MsTimeConstant', () => {
    let yaw = 0;
    const target = Math.PI / 2;
    yaw = easeYaw(yaw, target, 120);
    expect(yaw).toBeCloseTo(target * (1 - Math.exp(-1)), 6);
    for (let i = 0; i < 30; i++) yaw = easeYaw(yaw, target, 16);
    expect(yaw).toBeGreaterThan(target * 0.97);
    expect(yaw).toBeLessThanOrEqual(target);
  });

  it('Yaw_(AcrossPi)_ShouldNotSpinTheLongWay', () => {
    const yaw = easeYaw(3.0, -3.0, 60);
    expect(yaw).toBeGreaterThan(3.0);
  });

  it('Yaw_(ReducedMotion)_ShouldSnap', () => {
    expect(easeYaw(0, 1.2, 16, true)).toBe(1.2);
  });
});
