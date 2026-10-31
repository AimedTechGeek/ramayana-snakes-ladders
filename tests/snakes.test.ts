import { describe, expect, it } from 'vitest';
import { boardFor, LEVELS } from '../src/core/boards';
import easyMeta from '../public/assets/iso/snakes-easy.meta.json';
import mediumMeta from '../public/assets/iso/snakes-medium.meta.json';
import hardMeta from '../public/assets/iso/snakes-hard.meta.json';
import easyAtlas from '../public/assets/iso/snakes-easy.json';
import mediumAtlas from '../public/assets/iso/snakes-medium.json';
import hardAtlas from '../public/assets/iso/snakes-hard.json';
import type { Level } from '../src/core/types';

interface SnakeEntry {
  coil: { frame: string; anchor: [number, number] };
  head: { closed: string; open: string; pivot: [number, number]; mouth: [number, number]; neck: [number, number][] };
  body: string;
  R: number;
  headTop: number;
}
interface Meta {
  sheet: string;
  width: number;
  height: number;
  frames: Record<string, { w: number; h: number; factor: number; anchorX: number; anchorY: number }>;
  snakes: Record<string, SnakeEntry>;
}

const METAS: Record<Level, Meta> = { easy: easyMeta as unknown as Meta, medium: mediumMeta as unknown as Meta, hard: hardMeta as unknown as Meta };
const ATLASES: Record<Level, { frames: Record<string, unknown> }> = {
  easy: easyAtlas,
  medium: mediumAtlas,
  hard: hardAtlas,
};

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`missing ${what}`);
  return value;
}

/** Head top (z over TOP_Z) by body radius, spec 5.1 table; the 2.6-3.0 row is 33-34. */
function expectedTop(R: number): number {
  if (R <= 2.3) return 29;
  if (R <= 3.1) return 33.5;
  if (R <= 3.5) return 36;
  return 42;
}

describe('snake sheets', () => {
  it.each(LEVELS)('Every_Snake_Of_%s_Should_HaveACoilAndTwoHeadFramesInItsSheet', (level) => {
    for (const jump of boardFor(level).snakes) {
      const entry = need(METAS[level].snakes[jump.id], `${level} ${jump.id}`);
      for (const frame of [entry.coil.frame, entry.head.closed, entry.head.open]) {
        expect(ATLASES[level].frames[frame], `${jump.id} ${frame} in the atlas`).toBeDefined();
        expect(METAS[level].frames[frame], `${jump.id} ${frame} in the sidecar`).toBeDefined();
      }
    }
    expect(Object.keys(METAS[level].snakes)).toHaveLength(boardFor(level).snakes.length);
  });

  it.each(LEVELS)('Sheet_Of_%s_Should_BeAPowerOfTwoWithinTheBudget', (level) => {
    const { width, height } = METAS[level];
    for (const side of [width, height]) {
      expect(side & (side - 1)).toBe(0);
      expect(side).toBeLessThanOrEqual(1024);
    }
  });

  it.each(LEVELS)('HeadTop_Of_%s_Snakes_Should_BeWithinOnePxOfTheSizeTable', (level) => {
    for (const [id, entry] of Object.entries(METAS[level].snakes)) {
      expect(Math.abs(entry.headTop - expectedTop(entry.R)), id).toBeLessThanOrEqual(1);
    }
  });

  it.each(LEVELS)('Snakes_Of_%s_Should_CarryPivotMouthAndThreeNeckPoints', (level) => {
    for (const [id, entry] of Object.entries(METAS[level].snakes)) {
      const { pivot, mouth, neck } = entry.head;
      expect(pivot, id).toHaveLength(2);
      expect(mouth, id).toHaveLength(2);
      expect(neck, id).toHaveLength(3);
      for (const value of [...pivot, ...mouth, ...neck.flat()]) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it.each(LEVELS)('Pivot_Of_%s_Snakes_Should_LieInsideTheCoilFrameAndOnTheHeadAnchor', (level) => {
    const meta = METAS[level];
    for (const [id, entry] of Object.entries(meta.snakes)) {
      const coil = need(meta.frames[entry.coil.frame], entry.coil.frame);
      const closed = need(meta.frames[entry.head.closed], entry.head.closed);
      const open = need(meta.frames[entry.head.open], entry.head.open);
      const px = coil.anchorX + entry.head.pivot[0];
      const py = coil.anchorY + entry.head.pivot[1];
      expect(px, id).toBeGreaterThan(0);
      expect(px, id).toBeLessThan(coil.w);
      expect(py, id).toBeGreaterThan(0);
      expect(py, id).toBeLessThan(coil.h);
      // the head frames share one size and anchor (the pivot), so the closed and open pose turn about the same point
      expect(closed.w).toBe(open.w);
      expect(closed.h).toBe(open.h);
      expect(Math.abs(closed.anchorX - open.anchorX)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(closed.anchorY - open.anchorY)).toBeLessThanOrEqual(0.5);
      // the mouth lies inside the head frame, relative to the pivot
      expect(closed.anchorX + entry.head.mouth[0], id).toBeGreaterThan(0);
      expect(closed.anchorX + entry.head.mouth[0], id).toBeLessThan(closed.w);
      expect(closed.anchorY + entry.head.mouth[1], id).toBeGreaterThan(0);
      expect(closed.anchorY + entry.head.mouth[1], id).toBeLessThan(closed.h);
    }
  });

  it.each(LEVELS)('Frames_Of_%s_Should_BeDrawnAtTheFineFactor', (level) => {
    for (const frame of Object.values(METAS[level].frames)) expect(frame.factor).toBe(5);
  });

  it.each(LEVELS)('Sheet_Of_%s_Should_NotNameOrDescribeAHood', (level) => {
    const text = JSON.stringify([METAS[level], ATLASES[level]]).toLowerCase();
    expect(text).not.toContain('hood');
    expect(text).not.toContain('canopy');
    expect(text).not.toContain('halo');
  });
});
