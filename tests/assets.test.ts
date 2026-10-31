import { describe, expect, it } from 'vitest';
import {
  ASSETS,
  FAVICON_URL,
  figurineAssets,
  figurineFrame,
  figurineKey,
  FIGURINE_HEROES,
} from '../src/game/assets';

// Paths of every SVG under public/assets, relative to public/.
const FILES = new Set(
  Object.keys(import.meta.glob('../public/assets/**/*.svg', { query: '?url' })).map((p) =>
    p.replace('../public/', ''),
  ),
);

const PNGS = new Set(
  Object.keys(import.meta.glob('../public/assets/iso/fig/*.png', { query: '?url' })).map((p) =>
    p.replace('../public/', ''),
  ),
);

describe('asset manifest', () => {
  it('Every_(Manifest_Entry)_Should_(Exist_On_Disk_And_Use_A_Relative_Url)', () => {
    expect(FILES.size).toBeGreaterThan(0);
    for (const asset of [...ASSETS, { url: FAVICON_URL }]) {
      expect(asset.url.startsWith('/')).toBe(false);
      expect(FILES.has(asset.url), asset.url).toBe(true);
    }
  });

  it('EveryFigurineTexture_Should_ShipAsAPngWithAManifestFrame', () => {
    const assets = figurineAssets(FIGURINE_HEROES, ['s', 'm']);
    expect(assets).toHaveLength(FIGURINE_HEROES.length * 2 * 5 * 2);
    for (const asset of assets) expect(PNGS.has(asset.url), asset.url).toBe(true);
    expect(PNGS.size).toBeGreaterThanOrEqual(assets.length);
  });

  it('FigurineFrame_Should_PutTheFeetPointInsideItsTextureAtTwiceTheDisplayScale', () => {
    const frame = figurineFrame('hanuman', 'idle', false, 's');
    expect(frame.scale).toBe(2);
    expect(frame.anchorX).toBeGreaterThan(0);
    expect(frame.anchorX).toBeLessThan(frame.w);
    expect(frame.anchorY).toBeLessThan(frame.h);
    expect(figurineKey('hanuman', 'idle', true, 's')).not.toBe(figurineKey('hanuman', 'idle', false, 's'));
  });
});
