import { beforeAll, describe, expect, it } from 'vitest';
import { frameAnchor, nextPot, shelfPack } from '../scripts/art/iso/atlas.mjs';
import atlasJson from './fixtures/atlas/atlas-test.json';
import atlasMetaJson from './fixtures/atlas/atlas-test.meta.json';
import camera from '../src/game/iso/camera.json';
import { atlasOrigin, atlasSheet, type AtlasMeta } from '../src/game/assets';

const ANCHOR_TOLERANCE_PX = 0.5;
const meta = atlasMetaJson as AtlasMeta;
const hash = atlasJson as {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
};
const PNG_DATA_URL = Object.values(
  import.meta.glob('./fixtures/atlas/atlas-test.png', { query: '?inline', import: 'default', eager: true }),
)[0] as string;
// Frame names and factors the fixture generator was given (scripts/art/iso/atlas-test.mjs); the marker sits on its anchor.
const GIVEN: Record<string, { factor: number }> = {
  'fine-tall': { factor: 5 },
  'coarse-wide': { factor: 4 },
  'coarse-small': { factor: 4 },
};

interface Raster {
  width: number;
  height: number;
  rgba: Uint8Array;
}

async function inflate(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Minimal PNG decoder: 8-bit RGBA, non-interlaced (what the browser screenshot writes). */
async function decodePng(dataUrl: string): Promise<Raster> {
  const file = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const view = new DataView(file.buffer);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (offset < file.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...file.subarray(offset + 4, offset + 8));
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0)
        throw new Error('expected 8-bit RGBA, no interlace');
    } else if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const joined = new Uint8Array(new ArrayBuffer(idat.reduce((n, part) => n + part.length, 0)));
  idat.reduce((at, part) => (joined.set(part, at), at + part.length), 0);
  const raw = await inflate(joined);
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const left = i >= 4 ? (rgba[y * stride + i - 4] ?? 0) : 0;
      const up = y > 0 ? (rgba[(y - 1) * stride + i] ?? 0) : 0;
      const upLeft = y > 0 && i >= 4 ? (rgba[(y - 1) * stride + i - 4] ?? 0) : 0;
      let value = x;
      if (filter === 1) value = x + left;
      else if (filter === 2) value = x + up;
      else if (filter === 3) value = x + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      rgba[y * stride + i] = value & 255;
    }
  }
  return { width, height, rgba };
}

/** Alpha-weighted centroid of the pure magenta marker inside a rectangle of the sheet, in px from the rectangle's corner. */
function markerCentroid(
  raster: Raster,
  rect: { x: number; y: number; w: number; h: number },
): { x: number; y: number } {
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const at = (y * raster.width + x) * 4;
      const r = raster.rgba[at] ?? 0;
      const g = raster.rgba[at + 1] ?? 0;
      const b = raster.rgba[at + 2] ?? 0;
      const a = raster.rgba[at + 3] ?? 0;
      if (a === 0 || r < 200 || g > 60 || b < 200) continue;
      sum += a;
      sx += (x - rect.x + 0.5) * a;
      sy += (y - rect.y + 0.5) * a;
    }
  }
  if (!sum) throw new Error('marker not found');
  return { x: sx / sum, y: sy / sum };
}

describe('atlas packing', () => {
  const items = [
    { name: 'a', w: 100, h: 130 },
    { name: 'b', w: 244, h: 192 },
    { name: 'c', w: 100, h: 68 },
    { name: 'd', w: 100, h: 68 },
  ];

  it('Sheet_(Any_Frames)_Should_Have_Power_Of_Two_Sides_Within_Max_Size', () => {
    const { width, height } = shelfPack(items, 1024);
    for (const side of [width, height]) {
      expect(nextPot(side)).toBe(side);
      expect(side).toBeLessThanOrEqual(1024);
    }
  });

  it('Frames_(Packed_Together)_Should_Never_Overlap_Or_Leave_The_Sheet', () => {
    const { width, height, placements } = shelfPack(items, 1024);
    const rects = items.map((item) => ({ ...item, ...placements[item.name]! }));
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(width);
      expect(r.y + r.h).toBeLessThanOrEqual(height);
    }
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.name} overlaps ${b.name}`).toBe(true);
      }
    }
  });

  it('Packing_(Input_In_Any_Order)_Should_Give_The_Same_Layout', () => {
    expect(shelfPack([...items].reverse(), 1024)).toEqual(shelfPack(items, 1024));
  });

  it('Packing_(Frames_Too_Many_For_Max_Size)_Should_Fail_Loudly', () => {
    expect(() => shelfPack(items, 256)).toThrow(/do not fit|larger than/);
  });

  it('Frame_(Logical_Anchor_At_Factor_And_Padding)_Should_Land_In_Frame_Pixels', () => {
    expect(frameAnchor({ x: 10.3, y: 23.7 }, 5, 2)).toEqual({ x: 53.5, y: 120.5 });
  });
});

describe('atlas fixture (atlas-test, 3 dummy frames)', () => {
  let raster: Raster;
  beforeAll(async () => {
    raster = await decodePng(PNG_DATA_URL);
  });

  it('Sheet_(Generated_Fixture)_Should_Be_Power_Of_Two_And_Match_Its_Meta', () => {
    expect(nextPot(raster.width)).toBe(raster.width);
    expect(nextPot(raster.height)).toBe(raster.height);
    expect([meta.width, meta.height]).toEqual([raster.width, raster.height]);
  });

  it.each(Object.keys(GIVEN))(
    'Anchor_(%s_Marker_In_The_PNG)_Should_Round_Trip_Within_Half_A_Device_Pixel',
    (name) => {
      const entry = meta.frames[name]!;
      const rect = hash.frames[name]!.frame;
      expect([rect.w, rect.h]).toEqual([entry.w, entry.h]);
      expect(entry.factor).toBe(GIVEN[name]!.factor);
      const found = markerCentroid(raster, rect);
      expect(Math.abs(found.x - entry.anchorX)).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
      expect(Math.abs(found.y - entry.anchorY)).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
    },
  );

  it('Origin_(Runtime_Helper)_Should_Be_The_Anchor_Over_The_Frame_Size', () => {
    const entry = meta.frames['fine-tall']!;
    expect(atlasOrigin(entry)).toEqual({ x: entry.anchorX / entry.w, y: entry.anchorY / entry.h });
  });

  it('Sheet_(Url_Helper)_Should_Point_At_Png_Json_And_Meta', () => {
    expect(atlasSheet('props')).toEqual({
      key: 'props',
      png: 'assets/iso/props.png',
      json: 'assets/iso/props.json',
      meta: 'assets/iso/props.meta.json',
    });
  });
});

describe('camera.json raster contract', () => {
  it('Raster_(Camera_Json)_Should_Match_Fine_5_And_Coarse_4_Of_Spec_3_1', () => {
    expect(camera.raster).toEqual({ fine: 5, coarse: 4 });
    expect(camera.zoom).toEqual({ min: 1, follow: 2, max: 2.5 });
    expect(camera.panMargin).toBe(80);
  });
});
