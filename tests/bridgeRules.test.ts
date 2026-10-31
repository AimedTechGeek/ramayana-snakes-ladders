import { describe, expect, it } from 'vitest';
import easyMeta from '../public/assets/iso/bridges-easy.meta.json';
import { boardFor } from '../src/core/boards';
import { depthKey, fieldCentre, toScreen } from '../src/game/iso/boardIso';
import { TOKEN_DEPTH_BASE } from '../src/game/iso/tokenPose';
import { TOP_Z } from '../src/game/iso/world';
import { BAND, NUMERAL_DEPTH } from '../src/game/board/boardBands';
import {
  BEHIND_ALPHA,
  CROSS_HOP_HEIGHT,
  FAST_HOP_MS,
  bridgePose,
  crossingDepth,
  crossingHopCount,
  crossingMs,
  deckHeight,
  fadedSegments,
  hopAtProgress,
  hopPoint,
  routeAt,
  rowOfY,
  segmentsOf,
  walkHops,
  walkMs,
  type BridgeFrameMeta,
  type BridgeMeta,
} from '../src/game/board/bridgeRules';

const sheet = easyMeta as unknown as {
  frames: Record<string, BridgeFrameMeta>;
  bridges: Record<string, BridgeMeta>;
};
const bridge = (id: string) => sheet.bridges[id]!;
const segments = (id: string) => segmentsOf(bridge(id), sheet.frames);
const allSegments = Object.keys(sheet.bridges).flatMap(segments);
const walkOf = (id: string) => walkHops(bridge(id), fieldCentre(bridge(id).from), fieldCentre(bridge(id).to));

describe('bridge fade when behind (spec 6.4 rule 3)', () => {
  it('Segments_(Token_Rests_On_24)_Should_(Fade_Only_The_Vishwamitra_Segments_Covering_24)', () => {
    const faded = fadedSegments(allSegments, [24]);
    expect(faded.size).toBeGreaterThan(0);
    for (const name of faded) {
      expect(name.startsWith('vishwamitra.')).toBe(true);
      expect(sheet.frames[name]!.crossed).toContain(24);
    }
  });

  it('Segments_(Token_Rests_On_46)_Should_(Fade_The_Wedding_Segments_Covering_46)', () => {
    const faded = fadedSegments(allSegments, [46]);
    expect(faded.size).toBeGreaterThan(0);
    for (const name of faded) expect(name.startsWith('wedding.')).toBe(true);
  });

  it('Segments_(Token_Rests_On_119)_Should_(Fade_The_HanumanLeap_Segments_Covering_119)', () => {
    const faded = fadedSegments(allSegments, [119]);
    expect(faded.size).toBeGreaterThan(0);
    for (const name of faded) {
      expect(name.startsWith('hanuman-leap.')).toBe(true);
      expect(sheet.frames[name]!.crossed).toContain(119);
    }
  });

  it('Segments_(No_Token_On_A_Crossed_Square)_Should_(Stay_Solid)', () => {
    expect(fadedSegments(allSegments, [])).toEqual(new Set());
    expect(fadedSegments(allSegments, [1, 2, 3, 143])).toEqual(new Set());
  });

  it('Segments_(Token_On_46_Leaves_While_24_And_119_Stay)_Should_(Restore_Wedding_Only)', () => {
    const before = fadedSegments(allSegments, [24, 46, 119]);
    const after = fadedSegments(allSegments, [24, 119]);
    const restored = [...before].filter((name) => !after.has(name));
    expect(restored.length).toBeGreaterThan(0);
    for (const name of restored) expect(name.startsWith('wedding.')).toBe(true);
    expect([...after].some((name) => name.startsWith('vishwamitra.'))).toBe(true);
    expect([...after].some((name) => name.startsWith('hanuman-leap.'))).toBe(true);
  });

  it('Fade_(Alpha)_Should_(Be_0_35_As_Specified)', () => {
    expect(BEHIND_ALPHA).toBe(0.35);
  });
});

describe('bridge depth rules (spec 6.4 rules 2, 4 and 5)', () => {
  const restKey = (square: number) => {
    const [x, y] = fieldCentre(square);
    return depthKey([x, y, TOP_Z]);
  };

  it('SegmentDepth_(Every_Segment)_Should_(Sit_In_The_Standing_Band_Under_The_Numerals)', () => {
    for (const segment of allSegments) {
      expect(segment.depth).toBe(BAND.standing + segment.depthKey);
      expect(segment.depth).toBeLessThan(NUMERAL_DEPTH);
    }
  });

  /** Whether the token's body (feet up 40 px) overlaps the segment's sprite rectangle on screen. */
  const overlaps = (segmentName: string, square: number) => {
    const frame = sheet.frames[segmentName] as unknown as {
      world: [number, number];
      w: number;
      h: number;
      factor: number;
      anchorX: number;
      anchorY: number;
    };
    const anchor = toScreen([frame.world[0], frame.world[1], TOP_Z]);
    const left = anchor.x - frame.anchorX / frame.factor;
    const top = anchor.y - frame.anchorY / frame.factor;
    const [x, y] = fieldCentre(square);
    const feet = toScreen([x, y, TOP_Z]);
    return (
      feet.x >= left &&
      feet.x <= left + frame.w / frame.factor &&
      feet.y - 40 <= top + frame.h / frame.factor &&
      feet.y >= top
    );
  };

  it.each([
    ['vishwamitra', 24],
    ['wedding', 46],
    ['hanuman-leap', 119],
  ])(
    'Token_(Resting_Under_%s_On_%i)_Should_(Sort_Behind_Nearer_Segments_And_In_Front_Of_Farther_Ones_It_Overlaps)',
    (id, square) => {
      const token = TOKEN_DEPTH_BASE + restKey(square);
      const tokenRow = rowOfY(fieldCentre(square)[1]);
      const covering = segments(id).filter((segment) => overlaps(segment.name, square));
      expect(covering.length, 'the segment over the token is found').toBeGreaterThan(0);
      for (const segment of covering) {
        if (segment.row < tokenRow) expect(segment.depth, `${segment.name} nearer`).toBeGreaterThan(token);
        if (segment.row > tokenRow) expect(segment.depth, `${segment.name} farther`).toBeLessThan(token);
      }
    },
  );

  it.each([['vishwamitra'], ['wedding'], ['hanuman-leap']])(
    'CrossingToken_(Walking_%s)_Should_(Draw_Half_A_Unit_Over_The_Segment_Of_Its_Band_At_Every_Frame)',
    (id) => {
      const model = bridge(id);
      const own = segments(id);
      const rows = own.map((segment) => segment.row);
      for (const hop of walkOf(id)) {
        for (const u of [0, 0.25, 0.5, 0.75, 1]) {
          const [, y] = hopPoint(model, hop, u);
          const row = Math.min(Math.max(...rows), Math.max(Math.min(...rows), rowOfY(y)));
          const segment = own.find((candidate) => candidate.row === row)!;
          expect(bridgePose(model, own, hop, u).depth).toBe(segment.depth + 0.5);
        }
      }
    },
  );

  it('CrossingToken_(Walking_HanumanLeap)_Should_(Draw_In_Front_Of_The_Deck_Segment_It_Is_On)', () => {
    const own = segments('hanuman-leap');
    const model = bridge('hanuman-leap');
    for (const hop of walkOf('hanuman-leap')) {
      const [, y] = hopPoint(model, hop, 0.5);
      const segment = own.find((candidate) => candidate.row === rowOfY(y));
      if (segment) expect(crossingDepth(own, y)).toBeGreaterThan(segment.depth);
    }
  });

  it('CrossingToken_(Past_The_Last_Band)_Should_(Clamp_To_The_Nearest_Segment)', () => {
    const own = segments('vishwamitra');
    expect(crossingDepth(own, 0)).toBe(own.find((s) => s.row === Math.max(...own.map((o) => o.row)))!.depth + 0.5);
    expect(crossingDepth(own, 672)).toBe(own.find((s) => s.row === Math.min(...own.map((o) => o.row)))!.depth + 0.5);
  });
});

describe('bridge crossing timeline (spec 6.6)', () => {
  it('Crossing_(Vishwamitra)_Should_(Take_980_Ms_Within_20)', () => {
    expect(crossingHopCount(bridge('vishwamitra'))).toBe(7);
    expect(Math.abs(crossingMs(bridge('vishwamitra'), false) - 980)).toBeLessThanOrEqual(20);
  });

  it('Crossing_(Shabari)_Should_(Be_One_Hop)', () => {
    expect(crossingMs(bridge('shabari'), false)).toBe(140);
  });

  it('Crossing_(Fast)_Should_(Use_50_Ms_Hops)', () => {
    expect(crossingMs(bridge('vishwamitra'), true)).toBe(7 * FAST_HOP_MS);
  });

  it('Walk_(Every_Bridge)_Should_(Be_Step_On_Then_Deck_Hops_Then_Step_Off)', () => {
    for (const [id, model] of Object.entries(sheet.bridges)) {
      const hops = walkOf(id);
      expect(hops[0]!.kind, id).toBe('on');
      expect(hops.at(-1)!.kind, id).toBe('off');
      const crossing = hops.filter((hop) => hop.kind === 'cross');
      expect(crossing, id).toHaveLength(crossingHopCount(model));
      expect(hops.length * 140, id).toBe(walkMs(model, false));
      expect(crossing.at(-1)!.sTo, id).toBeCloseTo(model.length, 6);
    }
  });

  it('Walk_(Every_Bridge)_Should_(Run_Unbroken_From_The_Foot_Spot_To_The_Top_Spot)', () => {
    for (const [id, model] of Object.entries(sheet.bridges)) {
      const hops = walkOf(id);
      expect(hopPoint(model, hops[0]!, 0).slice(0, 2), id).toEqual([...fieldCentre(model.from)]);
      expect(hopPoint(model, hops.at(-1)!, 1).slice(0, 2), id).toEqual([...fieldCentre(model.to)]);
      for (let k = 0; k + 1 < hops.length; k++) {
        const a = hopPoint(model, hops[k]!, 1);
        const b = hopPoint(model, hops[k + 1]!, 0);
        expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `${id} hop ${k}`).toBeLessThan(1e-6);
        expect(Math.abs(a[2] - b[2]), `${id} hop ${k} z`).toBeLessThan(1e-6);
      }
    }
  });

  it('Walk_(Progress_Across_Nine_Hops)_Should_(Pick_The_Hop_By_The_Clock_And_End_On_The_Last)', () => {
    expect(hopAtProgress(9, 0)).toEqual({ index: 0, u: 0 });
    expect(hopAtProgress(9, 1 / 9 + 1e-9).index).toBe(1);
    expect(hopAtProgress(9, 0.5).index).toBe(4);
    expect(hopAtProgress(9, 0.5).u).toBeCloseTo(0.5, 9);
    expect(hopAtProgress(9, 1)).toEqual({ index: 8, u: 1 });
  });

  it('Bridges_(Easy_Sheet)_Should_(Cover_Every_Ladder_Foot_Of_The_Level)', () => {
    for (const ladder of boardFor('easy').ladders) expect(sheet.bridges[ladder.id]?.from).toBe(ladder.from);
  });
});

describe('deck height (spec 6.6, manifest samples every 4 units)', () => {
  it('DeckHeight_(At_A_Sample)_Should_(Equal_The_Manifest_Value)', () => {
    const model = bridge('vishwamitra');
    for (const [s, z] of model.deck) expect(deckHeight(model, s)).toBeCloseTo(z, 9);
  });

  it('DeckHeight_(Between_Two_Samples)_Should_(Interpolate_Linearly)', () => {
    const model = bridge('vishwamitra');
    const [s0, z0] = model.deck[3]!;
    const [s1, z1] = model.deck[4]!;
    expect(deckHeight(model, (s0 + s1) / 2)).toBeCloseTo((z0 + z1) / 2, 9);
  });

  it('DeckHeight_(Mid_Span)_Should_(Be_The_Arch_Apex_Above_The_Abutment_Deck)', () => {
    const model = bridge('vishwamitra');
    expect(deckHeight(model, model.length / 2)).toBeGreaterThan(TOP_Z + 3 + 20);
    expect(deckHeight(model, 0)).toBeCloseTo(TOP_Z + 3, 6);
    expect(deckHeight(model, model.length)).toBeCloseTo(TOP_Z + 3, 6);
  });

  it('DeckHeight_(Outside_The_Span)_Should_(Clamp_To_The_Abutment_Deck)', () => {
    const model = bridge('wedding');
    expect(deckHeight(model, -10)).toBeCloseTo(TOP_Z + 3, 6);
    expect(deckHeight(model, model.length + 10)).toBeCloseTo(TOP_Z + 3, 6);
  });

  it('CrossingHop_(Mid_Hop)_Should_(Ride_The_Deck_Plus_The_8_Unit_Hop_Arc)', () => {
    const model = bridge('wedding');
    const hop = walkOf('wedding')[2]!;
    const [x, y, z] = hopPoint(model, hop, 0.5);
    const s = (hop.sFrom + hop.sTo) / 2;
    expect(z).toBeCloseTo(deckHeight(model, s) + CROSS_HOP_HEIGHT, 9);
    expect([x, y]).toEqual([...routeAt(model, s)]);
  });
});
