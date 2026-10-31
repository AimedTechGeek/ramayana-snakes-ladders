import { describe, expect, it } from 'vitest';
import { boardFor, LEVELS } from '../src/core/boards';
import type { Level } from '../src/core/types';
import { depthKey, squareWorld } from '../scripts/art/iso-board.mjs';
import { mixHex } from '../scripts/art/iso/common.mjs';
import { tones } from '../scripts/art/iso/tones.mjs';
import {
  MIN_GAP,
  ORDER_TOLERANCE,
  proveBridges,
  segmentOrderProblems,
} from '../scripts/art/iso/bridges/audit.mjs';
import { buildBridge, type BuiltBridge } from '../scripts/art/iso/bridges/build.mjs';
import { bandOfY, bridgeGeometry, tileRect } from '../scripts/art/iso/bridges/geometry.mjs';
import { crossedBySegment, renderSegments, segmentAnchor } from '../scripts/art/iso/bridges/render.mjs';
import easyAtlas from '../public/assets/iso/bridges-easy.json';
import easyMeta from '../public/assets/iso/bridges-easy.meta.json';
import hardMeta from '../public/assets/iso/bridges-hard.meta.json';
import mediumMeta from '../public/assets/iso/bridges-medium.meta.json';
import { TOP_Z } from '../src/game/iso/world';

interface FrameMeta {
  bridge: string;
  row: number;
  order: number;
  world: [number, number];
  depthKey: number;
  crossed: number[];
  w: number;
  h: number;
  factor: number;
  anchorX: number;
  anchorY: number;
}
interface BridgeMeta {
  from: number;
  to: number;
  length: number;
  h: number;
  openings: number;
  bow: number;
  segments: string[];
  crossed: number[];
  deck: [number, number][];
  route: [number, number][];
}
interface SheetMeta {
  sheet: string;
  width: number;
  height: number;
  frames: Record<string, FrameMeta>;
  bridges: Record<string, BridgeMeta>;
}

const SHEETS: Record<Level, SheetMeta> = {
  easy: easyMeta as unknown as SheetMeta,
  medium: mediumMeta as unknown as SheetMeta,
  hard: hardMeta as unknown as SheetMeta,
};
const IDS = [
  'vishwamitra',
  'shiva-bow',
  'wedding',
  'guha',
  'shabari',
  'hanuman-meeting',
  'sugriva',
  'hanuman-leap',
  'rama-setu',
];

/** Spec 6.2 per-bridge table: L, h, openings, bands crossed and crossed squares. */
const SPEC: Record<string, { L: number; h: number; openings: number; rows: number[]; crossed: number[] }> = {
  vishwamitra: { L: 182, h: 22, openings: 4, rows: [1, 2, 3], crossed: [21, 22, 23, 24] },
  'shiva-bow': { L: 90, h: 14, openings: 2, rows: [2, 3, 4], crossed: [29, 30] },
  wedding: { L: 133, h: 18, openings: 3, rows: [3, 4, 5], crossed: [45, 46, 47] },
  guha: { L: 90, h: 14, openings: 2, rows: [5, 6, 7], crossed: [71, 72] },
  shabari: { L: 15, h: 8, openings: 1, rows: [8, 9], crossed: [] },
  'hanuman-meeting': { L: 90, h: 14, openings: 2, rows: [8, 9, 10], crossed: [104, 105] },
  sugriva: { L: 133, h: 18, openings: 3, rows: [8, 9, 10], crossed: [99, 100, 101] },
  'hanuman-leap': { L: 127, h: 17, openings: 3, rows: [8, 9, 10, 11], crossed: [98, 119] },
  // After the bow the ribbon clears 114 (spec 6.2: "the build recomputes").
  'rama-setu': { L: 133, h: 18, openings: 3, rows: [9, 10, 11], crossed: [115, 116] },
};

describe('bridge sheets', () => {
  it('Bridges_(Every_Ladder_Of_Every_Level)_Should_(Have_Segments_In_That_Level_Sheet)', () => {
    for (const level of LEVELS) {
      const sheet = SHEETS[level];
      const ladders = boardFor(level).ladders;
      expect(Object.keys(sheet.bridges).sort(), level).toEqual(ladders.map((j) => j.id).sort());
      for (const ladder of ladders) {
        const bridge = sheet.bridges[ladder.id];
        expect(bridge?.segments.length, `${level} ${ladder.id}`).toBeGreaterThanOrEqual(2);
        for (const name of bridge?.segments ?? []) expect(sheet.frames[name], name).toBeDefined();
      }
    }
  });

  it('Bridges_(Each_Level)_Should_(Match_The_Spec_6_1_Counts)', () => {
    expect(Object.keys(SHEETS.easy.bridges)).toHaveLength(9);
    expect(Object.keys(SHEETS.medium.bridges)).toHaveLength(7);
    expect(Object.keys(SHEETS.hard.bridges)).toHaveLength(6);
  });

  it('EasySheet_(Nine_Bridges)_Should_(Fit_1024_By_1024_And_Hold_Every_Frame_Once)', () => {
    expect(SHEETS.easy.width).toBeLessThanOrEqual(1024);
    expect(SHEETS.easy.height).toBeLessThanOrEqual(1024);
    const atlas = easyAtlas as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
    };
    expect(Object.keys(atlas.frames).sort()).toEqual(Object.keys(SHEETS.easy.frames).sort());
    for (const { frame } of Object.values(atlas.frames)) {
      expect(frame.x + frame.w).toBeLessThanOrEqual(SHEETS.easy.width);
      expect(frame.y + frame.h).toBeLessThanOrEqual(SHEETS.easy.height);
    }
  });

  it('Frames_(Coarse_Factor)_Should_(Be_Factor_4_With_The_Anchor_Inside_The_Frame)', () => {
    for (const level of LEVELS) {
      for (const [name, frame] of Object.entries(SHEETS[level].frames)) {
        expect(frame.factor, name).toBe(4);
        expect(frame.anchorX, name).toBeGreaterThan(0);
        expect(frame.anchorX, name).toBeLessThan(frame.w);
        expect(frame.anchorY, name).toBeGreaterThan(0);
        expect(frame.anchorY, name).toBeLessThan(frame.h);
      }
    }
  });
});

describe('bridge geometry (spec 6.2)', () => {
  it('Crossed_(Each_Bridge)_Should_(Equal_The_Spec_6_2_Table)', () => {
    for (const id of IDS) {
      expect(bridgeGeometry(id).crossed, id).toEqual(SPEC[id]?.crossed);
      for (const level of LEVELS) {
        const meta = SHEETS[level].bridges[id];
        if (meta) expect(meta.crossed, `${level} ${id}`).toEqual(SPEC[id]?.crossed);
      }
    }
  });

  it('Crossed_(Union_Of_The_Segments)_Should_(Be_The_Bridge_Squares)', () => {
    const sheet = SHEETS.easy;
    for (const id of IDS) {
      const fromSegments = (sheet.bridges[id]?.segments ?? []).flatMap(
        (name) => sheet.frames[name]?.crossed ?? [],
      );
      expect(
        [...new Set(fromSegments)].sort((a, b) => a - b),
        id,
      ).toEqual(SPEC[id]?.crossed);
    }
  });

  it('Bridge_(Length_Height_Openings)_Should_(Match_The_Spec_6_2_Table)', () => {
    for (const id of IDS) {
      const spec = SPEC[id];
      const g = bridgeGeometry(id);
      expect(Math.round(g.straight), id).toBe(spec?.L);
      expect(g.h, id).toBe(spec?.h);
      expect(g.openings, id).toBe(spec?.openings);
      expect(g.h, id).toBe(Math.min(22, Math.round(7 + 0.08 * g.straight)));
    }
  });

  it('Segments_(Each_Bridge)_Should_(Be_One_Per_Row_Band_From_Foot_To_Top)', () => {
    const sheet = SHEETS.easy;
    for (const id of IDS) {
      const rows = (sheet.bridges[id]?.segments ?? []).map((name) => sheet.frames[name]?.row);
      expect(rows, id).toEqual(SPEC[id]?.rows);
    }
  });

  it('SegmentAnchors_(Spec_6_4_Rule_2)_Should_(Be_The_Abutment_Centre_At_The_Ends_And_The_Band_Middle_Between)', () => {
    const sheet = SHEETS.easy;
    for (const id of IDS) {
      const g = bridgeGeometry(id);
      const names = sheet.bridges[id]?.segments ?? [];
      names.forEach((name, index) => {
        const frame = sheet.frames[name];
        const row = frame?.row ?? 0;
        if (index === 0)
          expect(frame?.world, name).toEqual([g.F[0], g.F[1]].map((v) => Math.round(v * 1000) / 1000));
        else if (index === names.length - 1)
          expect(frame?.world, name).toEqual([g.T[0], g.T[1]].map((v) => Math.round(v * 1000) / 1000));
        else expect(frame?.world[1], name).toBeCloseTo(672 - 56 * (row - 1 + 0.5), 1);
        const [x, y] = frame?.world ?? [0, 0];
        expect(frame?.depthKey, name).toBeCloseTo(depthKey([x, y, TOP_Z]), 2);
        expect(bandOfY(y)).toBe(row - 1);
      });
    }
  });

  it('SegmentDepthKeys_(Rows_Foot_To_Top)_Should_(Be_Monotonic_Except_Where_The_Bow_Turns_Back)', () => {
    const sheet = SHEETS.easy;
    for (const id of IDS) {
      const keys = (sheet.bridges[id]?.segments ?? []).map((name) => sheet.frames[name]?.depthKey ?? 0);
      const falling = keys.every((k, i) => i === 0 || k < (keys[i - 1] ?? 0));
      const rising = keys.every((k, i) => i === 0 || k > (keys[i - 1] ?? 0));
      // rama-setu is the one exception: the bow plus rule 2's abutment-centre end keys turn the order back at the top
      // (foot 186.9 > middle 182.5 < top 190.8). The painter's order is proven by the segment-order test instead.
      if (id === 'rama-setu') {
        expect(keys[0], keys.join(', ')).toBeGreaterThan(keys[1] ?? 0);
        expect(keys[2], keys.join(', ')).toBeGreaterThan(keys[1] ?? 0);
        continue;
      }
      expect(falling || rising, `${id}: ${keys.join(', ')}`).toBe(true);
    }
  });

  it('DeckSamples_(Each_Bridge)_Should_(Start_And_End_On_The_Foot_And_Top_Squares_At_Abutment_Height)', () => {
    for (const level of LEVELS) {
      for (const [id, bridge] of Object.entries(SHEETS[level].bridges)) {
        const [fx, fy] = squareWorld(bridge.from);
        const [tx, ty] = squareWorld(bridge.to);
        const start = bridge.route[0] as [number, number];
        const end = bridge.route[bridge.route.length - 1] as [number, number];
        expect(start, id).toEqual([fx, fy - 21]);
        expect(end, id).toEqual([tx, ty + 20]);
        const foot = tileRect(bridge.from, 27);
        const top = tileRect(bridge.to, 27);
        expect(
          start[0] >= foot.x0 && start[0] <= foot.x1 && start[1] >= foot.y0 && start[1] <= foot.y1,
          `${id} foot`,
        ).toBe(true);
        expect(
          end[0] >= top.x0 && end[0] <= top.x1 && end[1] >= top.y0 && end[1] <= top.y1,
          `${id} top`,
        ).toBe(true);
        expect(bridge.deck[0]).toEqual([0, TOP_Z + 3]);
        expect(bridge.deck[bridge.deck.length - 1]?.[1]).toBe(TOP_Z + 3);
        expect(bridge.deck.length, id).toBe(bridge.route.length);
        expect(bridge.deck.length, id).toBe(Math.ceil(bridge.length / 4) + 1);
      }
    }
  });

  it('DeckSamples_(Mid_Span)_Should_(Follow_The_Spec_Sine_Within_The_Table_Rounding)', () => {
    for (const id of IDS) {
      const bridge = SHEETS.easy.bridges[id];
      if (!bridge) continue;
      for (const [s, z] of bridge.deck) {
        expect(z, `${id} @${s}`).toBeCloseTo(
          TOP_Z + 3 + bridge.h * Math.sin((Math.PI * s) / bridge.length),
          2,
        );
      }
    }
  });
});

describe('bridge drawing (build, audit proofs)', () => {
  const built: Record<string, BuiltBridge> = {};
  for (const id of IDS) {
    built[id] = buildBridge(id);
    built[id].segments = renderSegments(built[id]);
  }

  it('Segments_(Row_Joints)_Should_(Sort_By_Depth_Key_In_Painters_Order)', () => {
    for (const id of IDS) {
      const bridge = built[id] as BuiltBridge;
      const worst = Math.max(0, ...segmentOrderProblems(bridge).map((p) => p.area));
      expect(worst, id).toBeLessThanOrEqual(ORDER_TOLERANCE);
    }
  }, 60_000);

  it('Segments_(Built_In_Memory)_Should_(Match_The_Shipped_Sheet_Frames_And_Keys)', () => {
    for (const id of IDS) {
      const bridge = built[id] as BuiltBridge;
      const shipped = SHEETS.easy.bridges[id]?.segments ?? [];
      expect(
        (bridge.segments ?? []).map((s) => s.name),
        id,
      ).toEqual(shipped);
      for (const s of bridge.segments ?? []) {
        expect(s.depthKey, s.name).toBeCloseTo(SHEETS.easy.frames[s.name]?.depthKey ?? 0, 2);
        expect(s.depthKey, s.name).toBeCloseTo(segmentAnchor(bridge.geo, s.band).depthKey, 2);
      }
    }
  });

  it('Openings_(Each_Bridge)_Should_(Be_Drawn_As_Many_Arches_As_The_Spec_Table_Says)', () => {
    for (const id of IDS) {
      const bridge = built[id] as BuiltBridge;
      expect(bridge.archInfo.length, id).toBe(bridge.geo.openings);
      expect(bridge.archInfo.length, id).toBe(SPEC[id]?.openings);
    }
  });

  it('CrossedSquares_(Per_Segment)_Should_(Come_From_The_Parts_That_Cover_The_Tile_And_Equal_The_Sheet)', () => {
    for (const id of IDS) {
      const bridge = built[id] as BuiltBridge;
      const bySegment = crossedBySegment(bridge);
      const union = [...new Set([...bySegment.values()].flat())].sort((a, b) => a - b);
      expect(union, id).toEqual(SPEC[id]?.crossed);
      for (const s of bridge.segments ?? []) {
        expect(s.crossed, s.name).toEqual(bySegment.get(s.band) ?? []);
        expect(SHEETS.easy.frames[s.name]?.crossed, s.name).toEqual(s.crossed);
      }
    }
  });

  it('BridgeParts_(Each_Bridge)_Should_(Be_Many_Small_Solids_Of_At_Least_Ten_Kinds)', () => {
    for (const id of IDS) {
      const bridge = built[id] as BuiltBridge;
      expect(bridge.R.solids.length, id).toBeGreaterThanOrEqual(40);
      expect(bridge.parts.size, id).toBeGreaterThanOrEqual(10);
    }
  });

  it('SnakeCoils_(Bridge_Solids)_Should_(Keep_At_Least_The_Minimum_Gap_On_Every_Level)', () => {
    const proofs = proveBridges(built);
    for (const { bridge, snake, gap } of proofs.pairs)
      expect(gap, `${bridge} vs ${snake}`).toBeGreaterThanOrEqual(MIN_GAP);
  }, 60_000);

  it('Wedding_(Deck_Over_Kaikeyis_Coil)_Should_(Clear_The_Coil_Top_By_About_Seven)', () => {
    const proofs = proveBridges({ wedding: built.wedding as BuiltBridge });
    expect(proofs.wedding?.clearance).toBeGreaterThanOrEqual(6.5);
  });

  it('RamaSetu_(Bowed_Ribbon)_Should_(Stay_Off_Indrajits_Coil_Plan)', () => {
    const proofs = proveBridges({ 'rama-setu': built['rama-setu'] as BuiltBridge });
    expect(proofs.setu?.plan).toBeGreaterThanOrEqual(proofs.setu?.R ?? 99);
  });

  it('Bridges_(Sugriva_And_RamaSetu_And_Every_Level_Pair)_Should_(Not_Overlap_In_Plan)', () => {
    const proofs = proveBridges(built);
    expect(proofs.sugriva?.overlap).toBe(false);
    expect(proofs.overlaps).toEqual([]);
  }, 60_000);
});

describe('tones (spec section 2)', () => {
  it('Tones_(Any_Hex)_Should_(Follow_The_Spec_Formula)', () => {
    const t = tones('#8E8A80');
    expect(t.top).toBe('#8E8A80');
    expect(t.shades[2]).toBe('#8E8A80');
    expect(t.shades[3]).toBe(mixHex('#8E8A80', '#FFFFFF', 0.12));
    expect(t.shades[1]).toBe(mixHex('#8E8A80', '#2A1A0F', 0.12));
    expect(t.shades[0]).toBe(mixHex('#8E8A80', '#2A1A0F', 0.26));
    expect(t.line).toBe(mixHex('#8E8A80', '#2A1A0F', 0.55));
  });
});
