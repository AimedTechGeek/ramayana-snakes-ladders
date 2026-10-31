import { describe, expect, it } from 'vitest';
import camera from '../src/game/iso/camera.json';
import rawMeta from '../public/assets/iso/hanuman-s.meta.json';
import rawClips from '../public/assets/iso/hanuman-s.clips.json';

interface FrameMeta {
  w: number;
  h: number;
  factor: number;
  anchorX: number;
  anchorY: number;
  clip: string;
  facing: string;
  index: number;
  planted: { foot: 'L' | 'R' | 'both' | null; offset: number | null };
  air: number;
  bob: number;
  soleU: number | null;
  marginPx: number;
  plantedLocal?: [number, number];
  plantedPx?: { x: number; y: number };
}

const sheet = rawMeta as unknown as { width: number; height: number; frames: Record<string, FrameMeta> };
const clips = rawClips as unknown as {
  facings: string[];
  clips: Record<string, { frames: number; cycle: number; speed: number }>;
};
const frames = sheet.frames;

const K = 0.7621; // logical px per world unit at zoom 1 (the board's own scale)
const FACTOR = 4;
const ZOOM = 2;
const DEG = Math.PI / 180;
const AXES: Record<string, [number, number]> = { SE: [1, 0], SW: [0, 1], NW: [-1, 0], NE: [0, -1] };
const LOCOMOTION = ['SE', 'NW', 'NE'];
const COUNTS: Record<string, number> = { walk: 8, run: 6, leap: 4 };

/** Screen px (logical, zoom 1) of a world offset (x, y, z) in the board camera. */
function screenOf(x: number, y: number, z: number): [number, number] {
  const a = camera.azimuth * DEG;
  const e = camera.elevation * DEG;
  return [
    (x * Math.sin(a) - y * Math.cos(a)) * K,
    ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * K,
  ];
}

/** World offset of a local (l, t) point of a character facing `facing` (l = to his right, t = forward). */
function worldOf(facing: string, l: number, t: number): [number, number] {
  const [tx, ty] = AXES[facing]!;
  return [l * ty + t * tx, -l * tx + t * ty];
}

const frame = (name: string) => frames[name]!;
const planted = (name: string) => frame(name).planted;
const mod = (value: number, step: number) => ((value % step) + step) % step;
/** Distance of `value` from the nearest multiple of `step`. */
const awayFromStep = (value: number, step: number) => Math.min(mod(value, step), step - mod(value, step));

describe('Hanuman sheet frames', () => {
  it('Sheet_Should_Hold61FramesIn2048x1024', () => {
    expect(Object.keys(frames)).toHaveLength(61);
    expect([sheet.width, sheet.height]).toEqual([2048, 1024]);
  });

  it('FrameNames_Should_FollowClipFacingIndexForTheLocomotionClipsAndTheSouthWestRestPoses', () => {
    const expected = ['idle.SW.0', 'idle.SW.1', 'idle.SW.2', 'SW.happy', 'SW.excited', 'SW.scared', 'SW.sad'];
    for (const clip of Object.keys(COUNTS)) {
      for (const facing of LOCOMOTION) {
        for (let i = 0; i < COUNTS[clip]!; i += 1) expected.push(`${clip}.${facing}.${i}`);
      }
    }
    expect(Object.keys(frames).sort()).toEqual(expected.sort());
    for (const name of expected) {
      const meta = frame(name);
      expect(meta.factor, name).toBe(FACTOR);
      if (name.startsWith('SW.')) expect(meta.facing).toBe('SW');
      else expect(name, name).toBe(`${meta.clip}.${meta.facing}.${meta.index}`);
    }
  });

  it('Clips_Should_ListTheFourFacingsAndTheCycleLengthsOfTheClipTable', () => {
    expect(clips.facings).toEqual(['SE', 'SW', 'NW', 'NE']);
    expect(clips.clips.walk).toMatchObject({ frames: 8, cycle: 32, speed: 80 });
    expect(clips.clips.run).toMatchObject({ frames: 6, cycle: 56, speed: 280 });
  });

  it('Anchor_Should_BeTheRootGroundPointSoTheSolesSitAtTheirLocalOffsetsFromIt', () => {
    const tolerancePx = 0.5;
    for (const [name, meta] of Object.entries(frames)) {
      if (!meta.plantedLocal || !meta.plantedPx) continue;
      const [l, t] = meta.plantedLocal;
      const [wx, wy] = worldOf(meta.facing, l, t);
      const [sx, sy] = screenOf(wx, wy, 0);
      expect(Math.abs(meta.plantedPx.x - meta.anchorX - sx * FACTOR), `${name} x`).toBeLessThanOrEqual(
        tolerancePx,
      );
      expect(Math.abs(meta.plantedPx.y - meta.anchorY - sy * FACTOR), `${name} y`).toBeLessThanOrEqual(
        tolerancePx,
      );
    }
  });

  it('PlantedSoles_Should_TouchTheGroundWithin0p3Px', () => {
    const limitUnits = 0.3 / (FACTOR * K * Math.cos(camera.elevation * DEG));
    for (const [name, meta] of Object.entries(frames)) {
      if (meta.planted.foot === null) {
        expect(meta.air, name).toBe(1);
        expect(meta.soleU, name).toBeNull();
      } else expect(Math.abs(meta.soleU!), name).toBeLessThanOrEqual(limitUnits);
    }
  });

  it('Drawing_Should_NeverTouchItsCropEdge', () => {
    for (const [name, meta] of Object.entries(frames)) expect(meta.marginPx, name).toBeGreaterThanOrEqual(2);
  });

  it('Walk_Should_PlantTheSameFootAtOffsetsFallingByACycleEighthPerFrame', () => {
    const { cycle, frames: n } = clips.clips.walk!;
    const perFrame = cycle / n;
    for (const facing of LOCOMOTION) {
      for (let i = 0; i < n; i += 1) {
        const a = planted(`walk.${facing}.${i}`);
        const b = planted(`walk.${facing}.${(i + 1) % n}`);
        const drop = a.offset! - b.offset!;
        // when the other foot lands the offset wraps by one step (half a cycle)
        expect(awayFromStep(drop - perFrame, cycle / 2), `walk.${facing}.${i}`).toBeLessThanOrEqual(0.05);
        if (a.foot === b.foot)
          expect(Math.abs(drop - perFrame), `walk.${facing}.${i}`).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it('Run_Should_PlantTheSameFootAtOffsetsFallingByACycleSixthAndFlyInTheAirFrames', () => {
    const { cycle, frames: n } = clips.clips.run!;
    const perFrame = cycle / n;
    for (const facing of LOCOMOTION) {
      for (const i of [0, 3]) {
        expect(frame(`run.${facing}.${i + 2}`).air, `${facing} air`).toBe(1);
        const contact = planted(`run.${facing}.${i}`);
        const down = planted(`run.${facing}.${i + 1}`);
        expect(contact.foot).toBe(down.foot);
        expect(Math.abs(contact.offset! - down.offset! - perFrame)).toBeLessThanOrEqual(0.05);
        // across the air frame the other foot lands two frames further on
        const next = planted(`run.${facing}.${(i + 3) % n}`);
        expect(
          awayFromStep(down.offset! - 2 * perFrame - next.offset!, cycle / 2),
          `run.${facing}.${i}`,
        ).toBeLessThanOrEqual(0.05);
      }
    }
  });

  it('PlantedFoot_Should_StayWithinOnePixelAtZoom2OverEveryHeldStanceOfWalkAndRun', () => {
    const limit = 1 / ZOOM; // logical px at zoom 1 that become 1 px at zoom 2
    for (const clip of ['walk', 'run']) {
      const { cycle, frames: n } = clips.clips[clip]!;
      const perFrame = cycle / n;
      for (const facing of LOCOMOTION) {
        for (let i = 0; i < n; i += 1) {
          const a = frame(`${clip}.${facing}.${i}`);
          const b = frame(`${clip}.${facing}.${(i + 1) % n}`);
          if (!a.plantedPx || !b.plantedPx || a.planted.foot !== b.planted.foot) continue;
          // the root travels perFrame along the facing; the foot is drawn relative to the anchor
          const [wx, wy] = worldOf(facing, 0, perFrame);
          const [rx, ry] = screenOf(wx, wy, 0);
          const dx = rx + (b.plantedPx.x - b.anchorX - (a.plantedPx.x - a.anchorX)) / FACTOR;
          const dy = ry + (b.plantedPx.y - b.anchorY - (a.plantedPx.y - a.anchorY)) / FACTOR;
          expect(Math.hypot(dx, dy), `${clip}.${facing}.${i}`).toBeLessThanOrEqual(limit);
        }
      }
    }
  });

  it('Leap_Should_LeaveTheGroundOnlyInItsAirFrame', () => {
    for (const facing of LOCOMOTION) {
      expect(frame(`leap.${facing}.2`).air).toBe(1);
      for (const i of [0, 1, 3]) expect(planted(`leap.${facing}.${i}`).foot, `${facing} ${i}`).toBe('both');
    }
  });
});
