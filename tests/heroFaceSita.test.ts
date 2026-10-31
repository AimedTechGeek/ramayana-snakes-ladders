// R2 (T44 4.4): Sita's faces never show sweat, tears or sparkles, `scared` keeps the idle brows, and the atlas has
// the six frames of the shared layout. The canvas is a recording stub (no DOM in node): every colour the painter
// uses is collected and the brow paths of the idle and scared frames are compared.
import { describe, expect, it } from 'vitest';
import { FACE_FRAMES } from '../src/app/board3d/heroClips';
import { ATLAS_H, ATLAS_W } from '../src/app/board3d/heroFace';
import { drawSitaAtlas } from '../src/app/board3d/heroFaceSita';

interface Recorder {
  colours: string[];
  curves: { frame: number; args: number[]; width: number; colour: string }[];
}

function stubContext(): { ctx: CanvasRenderingContext2D; rec: Recorder } {
  const rec: Recorder = { colours: [], curves: [] };
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 0 };
  const noop = (): void => undefined;
  const gradient = { addColorStop: (_o: number, c: string) => rec.colours.push(c) };
  const ctx = new Proxy(
    {
      createRadialGradient: () => gradient,
      quadraticCurveTo: (...a: number[]) => {
        const frame = Math.floor(a[0]! / (ATLAS_W / FACE_FRAMES.length));
        rec.curves.push({ frame, args: a, width: state.lineWidth, colour: String(state.strokeStyle) });
      },
    } as Record<string, unknown>,
    {
      get: (target, key: string) => (key in target ? target[key] : key in state ? state[key as keyof typeof state] : noop),
      set: (_t, key: string, value: unknown) => {
        if (key === 'fillStyle' || key === 'strokeStyle') rec.colours.push(String(value));
        (state as Record<string, unknown>)[key] = value;
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rec };
}

describe('Sita face atlas (R2)', () => {
  const { ctx, rec } = stubContext();
  drawSitaAtlas(ctx);

  it('Atlas_(Layout)_ShouldBeTheSharedSixFrameStrip', () => {
    expect(FACE_FRAMES).toHaveLength(6);
    expect(ATLAS_W / FACE_FRAMES.length).toBeCloseTo(170.67, 1);
    expect(ATLAS_H).toBe(192);
  });

  it('Faces_(Colours)_ShouldNeverPaintTheSweatDropTearOrSparkle', () => {
    const forbidden = ['#9cd2ec', '#fff3c4', 'rgba(156,210,236', '#9CD2EC'];
    for (const colour of rec.colours) for (const f of forbidden) expect(colour.toLowerCase()).not.toContain(f.toLowerCase());
  });

  it('Scared_(Brows)_ShouldBeTheIdleBrows', () => {
    const brows = (frame: number): number[][] =>
      rec.curves.filter((c) => c.frame === frame && Math.abs(c.width - 0.42 * (ATLAS_W / FACE_FRAMES.length / 12.4)) < 1e-6).map((c) => c.args);
    const idle = brows(FACE_FRAMES.indexOf('idle'));
    const scared = brows(FACE_FRAMES.indexOf('scared'));
    expect(idle).toHaveLength(2);
    // the same shape in the same frame cell: only the frame offset differs
    const cell = ATLAS_W / FACE_FRAMES.length;
    const shifted = (a: number[], by: number): number[] =>
      a.map((v, i) => Number((i % 2 === 0 ? v - by * cell : v).toFixed(4)));
    const scaredShifted = scared.map((a) => shifted(a, FACE_FRAMES.indexOf('scared')));
    const idleShifted = idle.map((a) => shifted(a, FACE_FRAMES.indexOf('idle')));
    expect(scaredShifted).toEqual(idleShifted);
  });
});
