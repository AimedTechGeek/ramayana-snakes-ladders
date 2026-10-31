import { describe, expect, it } from 'vitest';
import rawManifest from '../art-src/iso/figurines.json';

// T43: the standalone figurines are the SW rest poses of the walking character (no pedestal). The runtime loads these
// until T43.2 switches to the `hanuman-s` sheet; tests/figurineClips.test.ts covers the sheet itself.
const manifest = rawManifest as Record<
  string,
  { w: number; h: number; anchorX: number; anchorY: number; k: number }
>;
const keys = Object.keys(manifest);

describe('figurine manifest', () => {
  it('Hanuman_Should_HaveFiveEmotionsInThreeSizesPlainAndLit', () => {
    expect(keys.filter((key) => key.startsWith('hanuman.'))).toHaveLength(5 * 3 * 2);
  });

  it('SmallSprite_Should_UseTheBoardScaleSoATokenMatchesTheBoard', () => {
    expect(manifest['hanuman.idle.plain.s']!.k).toBeCloseTo(0.7621, 3);
  });

  it('EveryVariant_Should_KeepTheFeetPointInsideItsViewBox', () => {
    for (const key of keys) {
      const { w, h, anchorX, anchorY } = manifest[key]!;
      expect(anchorX).toBeGreaterThan(0);
      expect(anchorX).toBeLessThan(w);
      expect(anchorY).toBeGreaterThan(0);
      expect(anchorY).toBeLessThan(h);
    }
  });

  it('Anchor_Should_SitInTheLowerThirdOfTheFigureWhereItsFeetAre', () => {
    for (const key of keys) {
      const { h, anchorY } = manifest[key]!;
      expect(anchorY / h, key).toBeGreaterThan(0.6);
    }
  });

  it('LitVariants_Should_EqualThePlainOnes', () => {
    for (const key of keys.filter((k) => k.includes('.plain.'))) {
      expect(manifest[key.replace('.plain.', '.lit.')], key).toEqual(manifest[key]);
    }
  });
});
