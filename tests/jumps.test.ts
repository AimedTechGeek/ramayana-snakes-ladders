import { describe, expect, it } from 'vitest';
import * as nodeJumps from '../scripts/art/iso/jumps.mjs';
import {
  ladderInks,
  mixHex,
  numeralStrokes,
  NUMERAL_STROKES,
  seatBand,
  SEAT_COLOURS,
  snakeInks,
} from '../scripts/art/iso/common.mjs';
import { LEVELS, STORY_JUMPS } from '../src/core/boards';
import { HEROES } from '../src/game/heroes';
import { fieldCentre, glidePoint, HARD_CAP, jumpPath, jumpPaths } from '../src/game/iso/jumps';
import { TOP_Z } from '../src/game/iso/world';

const humpsOver = (level: 'easy' | 'medium' | 'hard', id: string) =>
  jumpPath(level, id)?.humps.map((h) => h.over) ?? [];

describe('jump paths', () => {
  it('JumpPaths_(Every_Level)_Should_(Match_The_Node_Twin_Exactly)', () => {
    for (const level of LEVELS) {
      expect(nodeJumps.jumpPaths(level), level).toEqual(jumpPaths(level));
    }
  });

  it('JumpPaths_(All_Levels)_Should_(Cover_All_22_Story_Jumps)', () => {
    const ids = new Set(LEVELS.flatMap((level) => jumpPaths(level).map((p) => p.id)));
    expect(ids.size).toBe(22);
    expect([...ids].sort()).toEqual(STORY_JUMPS.map((j) => j.id).sort());
  });

  it('JumpPaths_(Each_Jump)_Should_(Run_From_Field_Centre_Of_From_To_Field_Centre_Of_To)', () => {
    for (const level of LEVELS) {
      for (const path of jumpPaths(level)) {
        const first = path.points[0];
        const last = path.points[path.points.length - 1];
        const [fx, fy] = fieldCentre(path.from);
        const [tx, ty] = fieldCentre(path.to);
        expect([first?.[0], first?.[1]], path.id).toEqual([fx, fy]);
        expect(last?.[0], path.id).toBeCloseTo(tx, 6);
        expect(last?.[1], path.id).toBeCloseTo(ty, 6);
      }
    }
  });

  it('JumpPaths_(Draw_Order)_Should_(List_Ladders_Then_Snakes_With_Ravana_Last_On_Hard)', () => {
    const paths = jumpPaths('hard');
    const kinds = paths.map((p) => p.kind);
    expect(kinds.indexOf('snake')).toBe(kinds.lastIndexOf('ladder') + 1);
    expect(paths[paths.length - 1]?.id).toBe('ravana');
  });

  it('JumpPaths_(Any_Body)_Should_(Stay_Under_The_12_Unit_Hard_Cap)', () => {
    for (const level of LEVELS) {
      for (const path of jumpPaths(level)) {
        expect(path.reliefTop, `${level} ${path.id}`).toBeLessThanOrEqual(HARD_CAP + 1e-9);
      }
    }
  });

  it('Snakes_(Without_Crossings)_Should_(Keep_Their_Centreline_At_TOP_Z_Plus_Radius)', () => {
    const manthara = jumpPath('hard', 'manthara');
    expect(manthara?.humps).toEqual([]);
    expect(manthara?.points[0]?.[2]).toBeCloseTo(TOP_Z + 2.2, 9);
    const end = manthara?.points[manthara.points.length - 1];
    expect(end?.[2]).toBeCloseTo(TOP_Z + 2.2 * 0.45, 9);
  });

  it('Ravana_(Hard_Board)_Should_(Climb_Over_Brahmastra_Kumbhakarna_Prahasta_And_Indrajit)', () => {
    expect(humpsOver('hard', 'ravana')).toEqual(
      expect.arrayContaining(['brahmastra', 'kumbhakarna', 'prahasta', 'indrajit-arrows']),
    );
  });

  it('Snakes_(Crossing_The_Tail_Ladder)_Should_(Rise_3_8_Over_It)', () => {
    const hump = jumpPath('hard', 'prahasta')?.humps.find((h) => h.over === 'hanuman-leap');
    expect(hump?.height).toBeCloseTo(3.8, 9);
  });

  it('Humps_(Over_A_Snake)_Should_(Rise_Twice_The_Lower_Radius_Plus_0_6)', () => {
    const hump = jumpPath('hard', 'ravana')?.humps.find((h) => h.over === 'brahmastra');
    const lower = jumpPath('hard', 'brahmastra');
    expect(hump).toBeDefined();
    expect(lower).toBeDefined();
    // brahmastra R 2.2 tapers to 0.45 R, so 2 r + 0.6 lies between 2 x 0.99 + 0.6 and 2 x 2.2 + 0.6.
    expect(hump?.height).toBeGreaterThan(2 * 0.99 + 0.6);
    expect(hump?.height).toBeLessThan(2 * 2.2 + 0.6);
  });

  it('Humps_(Each_Crossing)_Should_(Add_A_Break_At_The_Crossing)', () => {
    for (const path of jumpPaths('hard')) {
      expect(path.breaks, path.id).toEqual(path.humps.map((h) => h.at));
    }
  });

  it('GlidePoint_(Snake)_Should_(Start_At_The_Head_And_End_At_The_Tail_At_Body_Height)', () => {
    const path = jumpPath('hard', 'ravana');
    expect(path).toBeDefined();
    if (!path) return;
    const start = glidePoint(path, 0);
    const end = glidePoint(path, 1);
    expect(start[2]).toBeCloseTo(TOP_Z + 8, 9);
    expect(end[2]).toBeCloseTo(TOP_Z + 8 * 0.45, 9);
    expect([end[0], end[1]]).toEqual([...fieldCentre(78)]);
  });
});

describe('ink and seat classes', () => {
  const SNAKE_INK_SPEC: Record<string, [string, string]> = {
    tataka: ['#687F62', '#3A5831'],
    manthara: ['#53556E', '#202141'],
    kaikeyi: ['#83637F', '#5D3456'],
    viradha: ['#AA8B6D', '#90683F'],
    shurpanakha: ['#8C6365', '#6A3435'],
    'golden-deer': ['#BAA65F', '#A58B2D'],
    abduction: ['#815F60', '#5B2F2F'],
    kabandha: ['#687F62', '#3A5831'],
    'indrajit-arrows': ['#626597', '#333675'],
    prahasta: ['#AA8B6D', '#90683F'],
    kumbhakarna: ['#987E67', '#795737'],
    brahmastra: ['#BF935D', '#AB732B'],
    ravana: ['#53556E', '#202141'],
  };
  const LADDER_INK_SPEC: Record<string, [string, string]> = {
    vishwamitra: ['#BFB7A4', '#BAA65F'],
    'shiva-bow': ['#BAA65F', '#626597'],
    wedding: ['#AE708B', '#BF935D'],
    guha: ['#A9A191', '#BF935D'],
    shabari: ['#6B8B67', '#8C6365'],
    'hanuman-meeting': ['#B7715F', '#BAA65F'],
    sugriva: ['#AA8B6D', '#BAA65F'],
    'hanuman-leap': ['#658DA2', '#BFB7A4'],
    'rama-setu': ['#AA8B6D', '#987E67'],
  };
  const SEAT_SPEC: Record<string, [string, string]> = {
    rama: ['#6289CD', '#3A5FA1'],
    sita: ['#D9749D', '#AB4B73'],
    lakshmana: ['#54AF86', '#2C845D'],
    hanuman: ['#E97554', '#BA4C2D'],
  };

  it('SnakeInks_(All_13_Snakes)_Should_(Equal_The_Spec_7_3_Table)', () => {
    const inks = snakeInks();
    expect(Object.keys(inks).sort()).toEqual(Object.keys(SNAKE_INK_SPEC).sort());
    for (const [id, [edge, head]] of Object.entries(SNAKE_INK_SPEC)) {
      expect([inks[id]?.edge, inks[id]?.head], id).toEqual([edge, head]);
    }
  });

  it('LadderInks_(All_9_Ladders)_Should_(Equal_The_Spec_7_4_Table)', () => {
    const inks = ladderInks();
    expect(Object.keys(inks).sort()).toEqual(Object.keys(LADDER_INK_SPEC).sort());
    for (const [id, [rail, rung]] of Object.entries(LADDER_INK_SPEC)) {
      expect([inks[id]?.rail, inks[id]?.rung], id).toEqual([rail, rung]);
    }
  });

  it('SeatBands_(Each_Hero)_Should_(Use_The_Hero_Colour_And_The_Spec_7_2_Shades)', () => {
    for (const [hero, [shade3, shade0]] of Object.entries(SEAT_SPEC)) {
      const band = seatBand(hero);
      expect(band.top, hero).toBe(HEROES[hero as keyof typeof HEROES].cssColor);
      expect([band.shades[3], band.shades[0]], hero).toEqual([shade3, shade0]);
      expect(band.shades[1], hero).toBe(mixHex(shade0, shade3, 1 / 3));
    }
    expect(Object.keys(SEAT_COLOURS).sort()).toEqual(Object.keys(HEROES).sort());
  });
});

describe('numeral strokes', () => {
  it('NumeralFont_(Every_Digit)_Should_(Fit_The_8_By_14_Grid)', () => {
    for (let digit = 0; digit <= 9; digit++) {
      const strokes = NUMERAL_STROKES[digit] as number[][][];
      expect(strokes.length, `digit ${digit}`).toBeGreaterThan(0);
      for (const [u, v] of strokes.flat()) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(8);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(14);
      }
    }
  });

  it('Numerals_(Two_Digits)_Should_(Centre_On_The_Tile_And_Stand_On_The_Sill)', () => {
    const points = numeralStrokes('10', 100, 200).flat();
    const xs = points.map(([x]) => x as number);
    const ys = points.map(([, y]) => y as number);
    // Box 18 wide (8 + advance 10) centred on x 100 = 91..109, the "1" glyph starts at u 1; baseline cy + 26, top cy + 12.
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([92, 109]);
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([212, 226]);
  });
});
