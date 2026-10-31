import { describe, expect, it } from 'vitest';
import atlasJson from '../public/assets/iso/props.json';
import metaJson from '../public/assets/iso/props.meta.json';
import { TOP_Z } from '../src/game/iso/world';

// The sidecar the props builder (scripts/art/iso/props.mjs) writes: one frame per prop kind (T42 spec 1.3, 1.5, 1.6, 2, 3).
interface PropFrame {
  kind: string;
  regions: string[];
  zone: 'side' | 'back' | 'centre';
  height: number;
  footprint: { w: number; d: number };
  parts: number;
  anim: string;
  baseZ: number;
  variety: boolean;
  landmark: boolean;
  squares?: number[];
  emit?: { x: number; y: number };
  w: number;
  h: number;
  factor: number;
  anchorX: number;
  anchorY: number;
}
const sidecar = metaJson as unknown as {
  width: number;
  height: number;
  padding: number;
  frames: Record<string, PropFrame>;
};
const hash = atlasJson as { frames: Record<string, unknown>; meta: { size: { w: number; h: number } } };
const frames = Object.values(sidecar.frames);

// Spec 1.3: side strips hold props up to 22 tall, the back strip up to 12 (10 x 6 footprint), the dais is 2.4..2.8.
const LIMITS = {
  side: { height: 22, width: 12, depth: 38 },
  back: { height: 12, width: 10, depth: 6 },
  centre: { height: 0.4, width: 32, depth: 32 },
};
const ANIMS = ['sway', 'flicker', 'smoke', 'shimmer', 'none'];
const REGIONS = ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'];
const frameOf = (kind: string): PropFrame => {
  const frame = sidecar.frames[kind];
  if (!frame) throw new Error(`no prop frame ${kind}`);
  return frame;
};
const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

describe('props atlas', () => {
  it('Props_(AllKinds)_ShouldBeAtLeastForty', () => {
    expect(frames.length).toBeGreaterThanOrEqual(40);
  });

  it('Frame_(EveryKind)_ShouldBeNamedByItsKindAndListedInThePhaserAtlas', () => {
    for (const [name, frame] of Object.entries(sidecar.frames)) {
      expect(frame.kind).toBe(name);
      expect(hash.frames[name]).toBeDefined();
    }
    expect(Object.keys(hash.frames).sort()).toEqual(Object.keys(sidecar.frames).sort());
  });

  it('Sheet_(Allocation)_ShouldBePowerOfTwoWithinOneThousandTwentyFourSquare', () => {
    expect(isPowerOfTwo(sidecar.width) && isPowerOfTwo(sidecar.height)).toBe(true);
    expect(sidecar.width).toBeLessThanOrEqual(1024);
    expect(sidecar.height).toBeLessThanOrEqual(1024);
    expect(hash.meta.size).toEqual({ w: sidecar.width, h: sidecar.height });
  });

  it.each(frames.map((frame) => [frame.kind, frame] as const))(
    'Meta_(%s)_ShouldCarryAnchorZoneHeightAndAnim',
    (_kind, frame) => {
      expect(frame.anchorX).toBeGreaterThan(0);
      expect(frame.anchorX).toBeLessThan(frame.w);
      expect(frame.anchorY).toBeGreaterThan(0);
      expect(frame.anchorY).toBeLessThan(frame.h);
      expect(['side', 'back', 'centre']).toContain(frame.zone);
      expect(frame.height).toBeGreaterThan(0);
      expect(ANIMS).toContain(frame.anim);
      expect(frame.factor).toBe(5);
    },
  );

  it.each(frames.map((frame) => [frame.kind, frame] as const))(
    'Height_(%s)_ShouldStayWithinItsZoneLimits',
    (_kind, frame) => {
      const limit = LIMITS[frame.zone];
      expect(frame.height).toBeLessThanOrEqual(limit.height);
      expect(frame.footprint.w).toBeLessThanOrEqual(limit.width);
      expect(frame.footprint.d).toBeLessThanOrEqual(limit.depth);
    },
  );

  it('Base_(EveryKind)_ShouldStandOnTheTileTop', () => {
    for (const frame of frames) expect(frame.baseZ).toBe(TOP_Z);
  });

  it('Parts_(EveryKind)_ShouldBeAtLeastFourSolids', () => {
    for (const frame of frames) expect(frame.parts, frame.kind).toBeGreaterThanOrEqual(4);
  });

  it.each(REGIONS)('Region_(%s)_ShouldOfferAtLeastSixKindsInItsRandomList', (region) => {
    const kinds = frames.filter((frame) => frame.variety && frame.regions.includes(region));
    expect(kinds.length).toBeGreaterThanOrEqual(6);
  });

  it('Zone_(RandomKinds)_ShouldFollowTheTwelveUnitBackStripRule', () => {
    // Spec 1.3 puts the second prop on the back strip "if its height is at most 12": the zone must say the same.
    for (const frame of frames.filter((f) => f.variety && f.zone !== 'centre'))
      expect(frame.zone, frame.kind).toBe(frame.height <= 12 ? 'back' : 'side');
  });

  it('Landmarks_(SpecSquares)_ShouldListTheirFixedSquares', () => {
    const squaresOf = (kind: string) => sidecar.frames[kind]?.squares;
    expect(squaresOf('janaka-palace')).toEqual([36]);
    expect(squaresOf('sage-hut')).toEqual([24]);
    expect(squaresOf('plough')).toEqual([30]);
    expect(squaresOf('chariot')).toEqual([42]);
    expect(squaresOf('panchavati-hut')).toEqual([66]);
    expect(squaresOf('cave-mouth')).toEqual([90]);
    expect(squaresOf('waterfall')).toEqual([96]);
    expect(squaresOf('rishyamukha-hill')).toEqual([97]);
    expect(squaresOf('broken-banner')).toEqual([137]);
    expect(squaresOf('dais')).toEqual([144]);
    expect(frameOf('dais').zone).toBe('centre');
  });

  it('Smoke_(HutsAndFires)_ShouldGiveAnEmitPoint', () => {
    for (const kind of ['sage-hut', 'panchavati-hut', 'fire']) expect(frameOf(kind).emit, kind).toBeDefined();
  });

  it('Regions_(EveryKind)_ShouldNameKnownRegions', () => {
    for (const frame of frames) for (const region of frame.regions) expect(REGIONS).toContain(region);
  });
});
