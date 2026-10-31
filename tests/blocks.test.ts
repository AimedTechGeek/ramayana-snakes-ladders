import { describe, expect, it } from 'vitest';
import {
  GANGA_SQUARES,
  REGIONS,
  frameNameOf,
  patternOf,
  propCountOf,
  regionOf,
  seedOf,
} from '../scripts/art/iso/blocks.mjs';
import { mixHex } from '../scripts/art/iso/common.mjs';
import { INK, tones } from '../scripts/art/iso/tones.mjs';
import blocksJson from '../public/assets/iso/blocks.json';
import blocksMeta from '../public/assets/iso/blocks.meta.json';
import sharedJson from '../public/assets/iso/shared.json';
import sharedMeta from '../public/assets/iso/shared.meta.json';

type Sheet = { meta: { size: { w: number; h: number } }; frames: Record<string, unknown> };
type Meta = {
  padding: number;
  frames: Record<string, { w: number; h: number; factor: number; anchorX: number; anchorY: number; fog?: boolean }>;
};
const blocks = blocksJson as unknown as Sheet;
const shared = sharedJson as unknown as Sheet;
const blocksSide = blocksMeta as unknown as Meta;
const sharedSide = sharedMeta as unknown as Meta;
const isPot = (n: number) => n > 0 && (n & (n - 1)) === 0;
const REGION_NAMES = ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'];
const brightness = (hex: string) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

describe('tones (spec section 2 formula)', () => {
  it('Tones_(Any_Hex)_Should_Use_The_Hex_As_Top_And_Shade_2', () => {
    const t = tones('#9CC46B');
    expect(t.top).toBe('#9CC46B');
    expect(t.shades[2]).toBe('#9CC46B');
  });
  it('Tones_(Any_Hex)_Should_Light_Shade_3_Twelve_Percent_Toward_White', () => {
    expect(tones('#9CC46B').shades[3]).toBe(mixHex('#9CC46B', '#FFFFFF', 0.12));
    expect(tones('#000000').shades[3]).toBe('#1F1F1F');
  });
  it('Tones_(Any_Hex)_Should_Darken_Shade_1_And_Shade_0_Twelve_And_26_Percent_Toward_Ink', () => {
    expect(INK).toBe('#2A1A0F');
    expect(tones('#FFFFFF').shades[1]).toBe(mixHex('#FFFFFF', INK, 0.12));
    expect(tones('#FFFFFF').shades[0]).toBe(mixHex('#FFFFFF', INK, 0.26));
  });
  it('Tones_(Any_Hex)_Should_Put_Lines_55_Percent_Toward_Ink', () => {
    expect(tones('#4E9BB8').line).toBe(mixHex('#4E9BB8', INK, 0.55));
  });
  it('Tones_(Any_Hex)_Should_Order_The_Four_Shades_Dark_To_Light', () => {
    const [s0, s1, s2, s3] = tones('#CF975B').shades.map(brightness) as [number, number, number, number];
    expect(s0).toBeLessThan(s1);
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
  });
});

describe('variety seed rule (spec 1.3)', () => {
  it('Seed_(Square)_Should_Be_The_Knuth_Hash_Of_The_Square_Number', () => {
    expect(seedOf(1)).toBe(2654435761);
    expect(seedOf(2)).toBe((2 * 2654435761) % 4294967296);
    expect(seedOf(144)).toBe((144 * 2654435761) % 4294967296);
  });
  it('Seed_(Same_Square)_Should_Be_Identical_On_Every_Call', () => {
    for (let square = 1; square <= 144; square++) expect(seedOf(square)).toBe(seedOf(square));
  });
  it('Pattern_(Square)_Should_Be_B_When_The_Seed_Low_Bit_Is_Set_Else_A', () => {
    for (let square = 1; square <= 144; square++) expect(patternOf(square)).toBe(seedOf(square) & 1 ? 'b' : 'a');
  });
  it('PropCount_(Any_Square)_Should_Be_One_Or_Two_From_Seed_Bit_1', () => {
    for (let square = 1; square <= 144; square++) {
      expect(propCountOf(square)).toBe(1 + ((seedOf(square) >>> 1) & 1));
    }
    const counts = new Set(Array.from({ length: 144 }, (_, i) => propCountOf(i + 1)));
    expect([...counts].sort()).toEqual([1, 2]);
  });
});

describe('regions of the 144 squares (spec section 2)', () => {
  const count = (name: string) => Array.from({ length: 144 }, (_, i) => regionOf(i + 1)).filter((r) => r === name).length;
  it('Region_(Squares_1_To_144)_Should_Cover_Each_Row_Band_And_The_Special_Tiles', () => {
    expect(count('mithila')).toBe(36);
    expect(count('ayodhya')).toBe(12);
    expect(count('dandaka')).toBe(30);
    expect(count('ganga')).toBe(6);
    expect(count('kishkindha')).toBe(24);
    expect(count('sea')).toBe(12);
    expect(count('lanka')).toBe(24);
    expect(GANGA_SQUARES).toEqual([49, 50, 71, 72, 73, 74]);
  });
  it('Region_(Square_Out_Of_Range)_Should_Throw', () => {
    expect(() => regionOf(0)).toThrow();
    expect(() => regionOf(145)).toThrow();
  });
});

describe('sheet sanity (blocks and shared, built by npm run art:blocks)', () => {
  it('Sheets_(Blocks_And_Shared)_Should_Be_Power_Of_Two_And_Fit_1024', () => {
    for (const sheet of [blocks, shared]) {
      expect(isPot(sheet.meta.size.w)).toBe(true);
      expect(isPot(sheet.meta.size.h)).toBe(true);
      expect(Math.max(sheet.meta.size.w, sheet.meta.size.h)).toBeLessThanOrEqual(1024);
    }
  });
  it('Blocks_(Sheet)_Should_Hold_13_Base_Tiles_And_One_Fog_Frame_Per_Region', () => {
    const frames = Object.values(blocksSide.frames);
    expect(frames.filter((f) => !f.fog)).toHaveLength(13);
    expect(frames.filter((f) => f.fog)).toHaveLength(7);
    for (const region of REGION_NAMES) expect(blocksSide.frames[`${region}-fog`]?.fog).toBe(true);
  });
  it('Blocks_(Every_Square)_Should_Find_Its_Base_Tile_Frame_In_The_Sheet', () => {
    for (let square = 1; square <= 144; square++) {
      expect(blocks.frames[frameNameOf(square)], `square ${square}`).toBeDefined();
    }
  });
  it('Blocks_(Regions_With_Two_Patterns)_Should_Have_Frames_A_And_B', () => {
    for (const [region, spec] of Object.entries(REGIONS)) {
      if (spec.b) {
        expect(blocks.frames[`${region}-a`]).toBeDefined();
        expect(blocks.frames[`${region}-b`]).toBeDefined();
      } else expect(blocks.frames[region]).toBeDefined();
    }
  });
  it('Blocks_(Tile_Frames)_Should_Use_The_Coarse_Factor_And_Keep_The_Anchor_Inside', () => {
    for (const [name, f] of Object.entries(blocksSide.frames)) {
      expect(f.factor, name).toBe(4);
      expect(f.anchorX, name).toBeGreaterThan(0);
      expect(f.anchorX, name).toBeLessThan(f.w);
      expect(f.anchorY, name).toBeLessThan(f.h);
    }
  });
  it('Shared_(Numerals)_Should_Have_Ten_Digits_In_Both_Inks_60_Pixels_Tall', () => {
    for (const ink of ['dark', 'bone']) {
      for (let digit = 0; digit <= 9; digit++) {
        const f = sharedSide.frames[`num-${digit}-${ink}`];
        expect(f, `num-${digit}-${ink}`).toBeDefined();
        expect(f?.factor).toBe(5);
        expect(Math.abs((f?.h ?? 0) - 2 * sharedSide.padding - 60)).toBeLessThanOrEqual(2);
      }
    }
  });
  it('Shared_(Fx)_Should_Hold_Mist_Shadow_Shimmer_Puff_Tongues_Bulge_And_Six_Bird_Frames', () => {
    const names = ['mist-1', 'mist-2', 'shadow', 'shimmer', 'puff', 'tongue-short', 'tongue-long', 'bulge'];
    for (const kind of ['gull', 'crow', 'parrot']) for (const f of [1, 2]) names.push(`bird-${kind}-${f}`);
    for (const name of names) expect(shared.frames[name], name).toBeDefined();
  });
});
