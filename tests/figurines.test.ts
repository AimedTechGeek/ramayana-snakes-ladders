import { describe, expect, it } from 'vitest';
import camera from '../src/game/iso/camera.json';
import rawManifest from '../public/assets/iso/figurines.json';

const PEDESTAL_R = 7;
const ANCHOR_TOLERANCE_PX = 0.3;
const manifest = rawManifest as Record<
  string,
  { w: number; h: number; anchorX: number; anchorY: number; k: number }
>;

// Source text of every figurine SVG, by path relative to public/assets/iso.
const FILES = import.meta.glob('../public/assets/iso/fig/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const keys = Object.keys(manifest);

/** Screen points of the outline of the part tagged `pedestal-base`: the bottom disc of the pedestal. */
function baseOutline(svg: string): [number, number][] {
  const d = /data-part="pedestal-base">.*?class="iso-line iso-edge"[^>]*d="([^"]+)"/s.exec(svg)?.[1] ?? '';
  return [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

function svgOf(key: string): string {
  const [hero, emotion, variant, size] = key.split('.');
  const name = `${hero}-${emotion}${variant === 'lit' ? '-lit' : ''}-${size}`;
  const svg = FILES[`../public/assets/iso/fig/${name}.svg`];
  if (!svg) throw new Error(`missing ${name}.svg`);
  return svg;
}

describe('figurine manifest', () => {
  it('Hanuman_Should_HaveFiveEmotionsInThreeSizesPlainAndLit', () => {
    expect(keys.filter((key) => key.startsWith('hanuman.'))).toHaveLength(5 * 3 * 2);
  });

  it('FeetAnchor_Should_LieOnThePedestalBottomPointWithinPointThreePx', () => {
    const sinElevation = Math.sin((camera.elevation * Math.PI) / 180);
    for (const key of keys) {
      const { anchorX, anchorY, k } = manifest[key]!;
      const outline = baseOutline(svgOf(key));
      const xs = outline.map(([x]) => x);
      const ys = outline.map(([, y]) => y);
      const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
      // The front of the bottom rim is PEDESTAL_R toward the viewer: sin(elevation) * k px below the feet point.
      const centreY = Math.max(...ys) - PEDESTAL_R * sinElevation * k;
      expect(Math.abs(centreX - anchorX), `${key} x`).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
      expect(Math.abs(centreY - anchorY), `${key} y`).toBeLessThanOrEqual(ANCHOR_TOLERANCE_PX);
    }
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
});
