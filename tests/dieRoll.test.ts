import { readFileSync } from 'node:fs';
import { Quaternion, QuaternionKeyframeTrack, Vector3, type AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLIP_COUNT,
  CLIP_FPS,
  CLIP_FRAMES,
  CONTACT_FRAMES,
  DIE_HALF_EDGE,
  DIE_VALUES,
  FACE_NORMALS,
  clipIndex,
  correctedOrientation,
  finalOrientation,
  isTap,
  restHeight,
  rollSeconds,
  topFace,
} from '../src/app/board3d/dieRoll';

const GLB = new URL('../public/models/dice/die.glb', import.meta.url);
let clips: AnimationClip[] = [];

function clipEnd(clip: AnimationClip): Quaternion {
  const track = clip.tracks.find((t) => t instanceof QuaternionKeyframeTrack && t.name.startsWith('die.'));
  if (!track) throw new Error(`no die quaternion track in ${clip.name}`);
  const v = track.values;
  return new Quaternion(v[v.length - 4], v[v.length - 3], v[v.length - 2], v[v.length - 1]).normalize();
}

function clipPoseAt(clip: AnimationClip, frame: number): Quaternion {
  const track = clip.tracks.find((t) => t instanceof QuaternionKeyframeTrack && t.name.startsWith('die.'));
  if (!track) throw new Error('no track');
  const i = Math.round(frame) * 4;
  return new Quaternion(
    track.values[i],
    track.values[i + 1],
    track.values[i + 2],
    track.values[i + 3],
  ).normalize();
}

beforeAll(async () => {
  const bytes = readFileSync(GLB);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  clips = [0, 1, 2].map((i) => {
    const clip = gltf.animations.find((a) => a.name === `tumble_${i}`);
    if (!clip) throw new Error(`tumble_${i} missing from die.glb`);
    return clip;
  });
});

describe('the baked tumble clips', () => {
  it('Die_(Model)_Should_Carry_Three_One_Second_Clips', () => {
    expect(clips).toHaveLength(CLIP_COUNT);
    for (const clip of clips) expect(clip.duration).toBeCloseTo(CLIP_FRAMES / CLIP_FPS, 5);
  });

  it('Die_(RollsOfEveryValueOnEveryClip)_Should_LandWithTheValueFaceUp', () => {
    for (const clip of clips) {
      for (const value of DIE_VALUES) {
        const q = finalOrientation(clipEnd(clip), value);
        const up = new Vector3(...FACE_NORMALS[value]).applyQuaternion(q);
        expect(up.y, `${clip.name} value ${value}`).toBeCloseTo(1, 5);
        expect(topFace(q)).toBe(value);
      }
    }
  });

  it('Die_(LastFrameOfTheBlend)_Should_EqualTheFinalOrientation', () => {
    for (const clip of clips) {
      for (const value of DIE_VALUES) {
        const end = clipEnd(clip);
        const blended = correctedOrientation(clipPoseAt(clip, CLIP_FRAMES), end, value, CLIP_FRAMES);
        expect(topFace(blended)).toBe(value);
        expect(Math.abs(blended.dot(finalOrientation(end, value)))).toBeCloseTo(1, 5);
      }
    }
  });

  it('Die_(BeforeTheCorrectionWindow)_Should_FollowTheClipUntouched', () => {
    const clip = clips[0]!;
    const q = correctedOrientation(clipPoseAt(clip, 10), clipEnd(clip), 5, 10);
    expect(Math.abs(q.dot(clipPoseAt(clip, 10)))).toBeCloseTo(1, 6);
  });

  it('Die_(AtEveryFloorContact)_Should_BeAxisAlignedToTheFloor', () => {
    for (const clip of clips) {
      for (const frame of CONTACT_FRAMES) {
        expect(restHeight(clipPoseAt(clip, frame)), `${clip.name} frame ${frame}`).toBeCloseTo(
          DIE_HALF_EDGE,
          2,
        );
      }
    }
  });

  it('Die_(DuringTheCorrection)_Should_NeverSinkBelowTheFloor', () => {
    const clip = clips[1]!;
    for (const value of DIE_VALUES) {
      for (let frame = 18; frame <= CLIP_FRAMES; frame++) {
        const q = correctedOrientation(clipPoseAt(clip, frame), clipEnd(clip), value, frame);
        expect(restHeight(q)).toBeGreaterThanOrEqual(DIE_HALF_EDGE - 1e-6);
      }
    }
  });
});

describe('the roll rules', () => {
  it('Roll_(Fast)_Should_TakeFourTenthsOfASecond', () => {
    expect(rollSeconds(true)).toBeCloseTo(0.4, 6);
    expect(rollSeconds(false)).toBeCloseTo(1.0, 6);
  });

  it('Roll_(ValueAndTurn)_Should_PickTheClipByValuePlusTurnModThree', () => {
    expect(clipIndex(1, 0)).toBe(1);
    expect(clipIndex(6, 0)).toBe(0);
    expect(clipIndex(5, 2)).toBe(1);
    expect(clipIndex(3, 7)).toBe(1);
  });

  it('Roll_(EveryValueAndTurn)_Should_UseAllThreeClips', () => {
    const used = new Set<number>();
    for (const value of DIE_VALUES) for (let turn = 0; turn < 3; turn++) used.add(clipIndex(value, turn));
    expect(used).toEqual(new Set([0, 1, 2]));
  });
});

describe('tap versus drag', () => {
  const down = { x: 100, y: 100, t: 1000 };

  it('Tap_(ShortAndStill)_Should_Count', () => {
    expect(isTap(down, { x: 103, y: 104, t: 1120 })).toBe(true);
  });

  it('Tap_(ExactlyAtTheEightPxAnd300msLimits)_Should_Count', () => {
    expect(isTap(down, { x: 108, y: 100, t: 1300 })).toBe(true);
  });

  it('Tap_(MovedMoreThanEightPx)_Should_BeADrag', () => {
    expect(isTap(down, { x: 109, y: 100, t: 1100 })).toBe(false);
    expect(isTap(down, { x: 106, y: 106, t: 1100 })).toBe(false);
  });

  it('Tap_(HeldLongerThan300ms)_Should_BeADrag', () => {
    expect(isTap(down, { x: 100, y: 100, t: 1301 })).toBe(false);
  });
});
