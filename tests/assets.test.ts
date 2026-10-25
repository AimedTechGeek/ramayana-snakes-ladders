import { describe, expect, it } from 'vitest';
import { STORY_JUMPS } from '../src/core/boards';
import { ASSETS, FAVICON_URL, LADDER_LOOKS, SNAKE_LOOKS, snakeHeadKey } from '../src/game/assets';

// Paths of every SVG under public/assets, relative to public/.
const FILES = new Set(
  Object.keys(import.meta.glob('../public/assets/**/*.svg', { query: '?url' })).map((p) =>
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

  it('Every_(Snake_Story_Jump)_Should_(Have_A_Head_Image_And_A_Palette_Entry)', () => {
    const keys = new Set(ASSETS.map((a) => a.key));
    for (const jump of STORY_JUMPS.filter((j) => j.kind === 'snake')) {
      expect(keys.has(snakeHeadKey(jump.id)), jump.id).toBe(true);
      expect(SNAKE_LOOKS[jump.id], jump.id).toBeDefined();
    }
  });

  it('Every_(Ladder_Story_Jump)_Should_(Have_A_Palette_Entry)', () => {
    for (const jump of STORY_JUMPS.filter((j) => j.kind === 'ladder')) {
      expect(LADDER_LOOKS[jump.id], jump.id).toBeDefined();
    }
  });
});
