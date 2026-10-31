import { describe, expect, it } from 'vitest';
import { framePlacements, frameFixtures, OVERLAP, PITCH } from '../scripts/art/iso/frame.mjs';
import { tones } from '../scripts/art/iso/tones.mjs';
import { RIM, SIZE } from '../scripts/art/iso/world.mjs';
import frameMeta from '../public/assets/iso/frame.meta.json';

const placements = framePlacements();
const bars = (side: string) => placements.filter((p) => p.frame === `rim-${side}`);

describe('frame placement list', () => {
  it('Frame_(PlacementList)_Should_HoldFiftyTwoModules', () => {
    expect(placements).toHaveLength(52);
    expect(new Set(placements.map((p) => p.id)).size).toBe(52);
  });

  it('Frame_(EachSide)_Should_HoldTwelveBarsAtPitchFiftySix', () => {
    expect(PITCH).toBe(56);
    for (const side of ['front', 'back', 'left', 'right']) {
      const along = bars(side).map((p) => (side === 'front' || side === 'back' ? p.world[0] : p.world[1]));
      expect(along).toHaveLength(12);
      along.forEach((value, i) => expect(value).toBe(i * PITCH + PITCH / 2));
    }
  });

  it('Frame_(Bars)_Should_CoverTheFieldEdgeFromZeroToItsFarEnd', () => {
    const front = bars('front').map((p) => p.world[0]);
    expect(Math.min(...front) - PITCH / 2).toBe(0);
    expect(Math.max(...front) + PITCH / 2).toBe(SIZE);
  });

  it('Frame_(Bars)_Should_SitOnTheirOwnSideOfTheField', () => {
    for (const p of bars('front')) expect(p.world[1]).toBe(SIZE + RIM / 2);
    for (const p of bars('back')) expect(p.world[1]).toBe(-RIM / 2);
    for (const p of bars('left')) expect(p.world[0]).toBe(-RIM / 2);
    for (const p of bars('right')) expect(p.world[0]).toBe(SIZE + RIM / 2);
  });

  it('Frame_(Corners)_Should_StandOnThePlinthCorners', () => {
    const plinth = { min: -RIM, max: SIZE + RIM };
    const corners = placements.filter((p) => p.frame.startsWith('corner-'));
    expect(corners.map((p) => p.frame).sort()).toEqual(['corner-ne', 'corner-nw', 'corner-se', 'corner-sw']);
    for (const c of corners) {
      const [x, y] = c.world;
      // a 22 x 22 module whose outer corner is a plinth corner
      expect([x - RIM / 2, x + RIM / 2]).toContain(x < 0 ? plinth.min : plinth.max);
      expect([y - RIM / 2, y + RIM / 2]).toContain(y < 0 ? plinth.min : plinth.max);
      expect(Math.abs(x < 0 ? x - plinth.min : plinth.max - x)).toBe(RIM / 2);
      expect(Math.abs(y < 0 ? y - plinth.min : plinth.max - y)).toBe(RIM / 2);
    }
  });

  it('Frame_(JointsOverlap)_Should_ReachOneUnitBackIntoTheEarlierModule', () => {
    expect(OVERLAP).toBe(1);
  });

  it('Frame_(Fixtures)_Should_HoldGateParasolMakerAndFiveChapterPlates', () => {
    const fixtures = frameFixtures();
    expect(fixtures.map((f) => f.frame).sort()).toEqual([
      'gate',
      'parasol',
      'plate-chapter-1',
      'plate-chapter-2',
      'plate-chapter-3',
      'plate-chapter-4',
      'plate-chapter-5',
      'plate-maker',
    ]);
  });

  it('Frame_(Plates)_Should_DrawAfterTheLastBarTheyLieOver', () => {
    const fixtures = Object.fromEntries(frameFixtures().map((f) => [f.id, f]));
    expect(fixtures['maker']?.depthAt[0]).toBe(7 * PITCH + PITCH / 2); // x 276..396 reaches bar 8 (392..448)
    expect(fixtures['chapter-4']?.depthAt[1]).toBe(4 * PITCH + PITCH / 2); // y 217..231 straddles the joint at 224
    for (const id of ['maker', 'chapter-1', 'chapter-4']) expect(fixtures[id]?.depthBias).toBeGreaterThan(0);
  });
});

describe('frame sheet sidecar', () => {
  it('Frame_(CommittedSheet)_Should_CarryTheSamePlacementsAsTheBuilder', () => {
    expect(frameMeta.placements).toEqual(placements);
    expect(frameMeta.fixtures).toEqual(frameFixtures());
    expect(frameMeta.pitch).toBe(PITCH);
  });

  it('Frame_(CommittedSheet)_Should_HoldSixteenFramesAtTheCoarseFactor', () => {
    const frames = Object.values(frameMeta.frames);
    expect(frames).toHaveLength(16);
    for (const f of frames) expect(f.factor).toBe(4);
  });

  it('Frame_(EveryPlacement)_Should_NameAFrameOfTheSheet', () => {
    for (const p of [...frameMeta.placements, ...frameMeta.fixtures]) {
      expect(Object.keys(frameMeta.frames)).toContain(p.frame);
    }
  });
});

describe('tone formula', () => {
  it('Tones_(BrassHex)_Should_FollowTheSpecFormula', () => {
    const brass = tones('#C9A24A');
    expect(brass.top).toBe('#C9A24A');
    expect(brass.shades[2]).toBe('#C9A24A');
    expect(brass.shades[3]).toBe('#CFAD60'); // 12 % toward white
    expect(brass.shades[1]).toBe('#B69243'); // 12 % toward ink #2A1A0F
    expect(brass.shades[0]).toBe('#A07F3B'); // 26 % toward ink
    expect(brass.line).toBe('#72572A'); // 55 % toward ink
  });
});
