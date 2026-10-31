// The 3D arched stone bridges (T44 6.2-6.5): the nine (foot, top) pairs, the T42 6.5 audit pairs re-asserted on the
// 3D layout, the crossing time of the spec table, fade-when-behind, and that the GLB deck, the manifest the Blender
// build wrote and the path a hero runs along are one curve.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boardFor, LEVELS } from '../src/core/boards';
import { fieldCentre } from '../src/game/iso/boardIso';
import { restingSpot } from '../src/game/iso/tokenPose';
import { CELL } from '../src/game/iso/world';
import { blockTopY, squareCentre } from '../src/app/board3d/boardLayout';
import {
  ABUTMENT_H,
  ABUTMENT_WIDTH,
  BRIDGE_PAIRS,
  DECK_SAMPLES,
  DECK_WIDTH,
  FOOT_ABUTMENT_DEPTH,
  PARAPET_WIDTH,
  bridgeById,
  bridges,
  deckHeightAt,
  routeAt,
  WEDDING_BOW,
  WEDDING_HUMP,
} from '../src/app/board3d/bridgeGeometry';
import {
  BEHIND_OPACITY,
  FADE_MS,
  backOut,
  chunkProgress,
  fadeTarget,
  riseClock,
  riseTotalMs,
  stepOpacity,
  thudScale,
} from '../src/app/board3d/bridgeLook';
import { crossingMs, crossingPlan } from '../src/app/board3d/crossing';
import { bridgeCurve, bridgeLeads } from '../src/app/board3d/jumpCurves';
import manifest from '../src/app/board3d/bridgesManifest.json';

/** T42 6.1: the nine bridges by square pair. */
const PAIRS: Record<string, [number, number]> = {
  vishwamitra: [4, 25],
  'shiva-bow': [20, 43],
  wedding: [26, 52],
  guha: [49, 74],
  shabari: [85, 108],
  'hanuman-meeting': [88, 113],
  sugriva: [92, 118],
  'hanuman-leap': [95, 122],
  'rama-setu': [101, 127],
};
/** T42 6.2 per-bridge table: L (px), h (px), openings, crossed squares (rama-setu after the bow). */
const SPEC: Record<string, { L: number; h: number; openings: number; crossed: number[] }> = {
  vishwamitra: { L: 182, h: 22, openings: 4, crossed: [21, 22, 23, 24] },
  'shiva-bow': { L: 90, h: 14, openings: 2, crossed: [29, 30] },
  // owner, T44.14: the wedding deck bows 0.6 u toward the viewer and its hump drops to 0.2 u (11 px) so Kaikeyi on 46
  // strikes in full behind it; the bowed ribbon clips 27's back corner and runs along the front of 45-46
  wedding: { L: 133, h: 11, openings: 3, crossed: [27, 45, 46] },
  guha: { L: 90, h: 14, openings: 2, crossed: [71, 72] },
  shabari: { L: 15, h: 8, openings: 1, crossed: [] },
  'hanuman-meeting': { L: 90, h: 14, openings: 2, crossed: [104, 105] },
  sugriva: { L: 133, h: 18, openings: 3, crossed: [99, 100, 101] },
  'hanuman-leap': { L: 127, h: 17, openings: 3, crossed: [98, 119] },
  'rama-setu': { L: 133, h: 18, openings: 3, crossed: [115, 116] },
};
const BODY_WIDTH = DECK_WIDTH + 2 * PARAPET_WIDTH;
/** Deck thickness including the flagstone (bridges.py CORE_T). */
const CORE_THICKNESS = 0.045;

function crossingTime(id: string, fast = false, hero: 'rama' | 'hanuman' = 'rama'): number {
  const path = bridgeCurve({ ...stub(id) });
  const leads = bridgeLeads(path);
  return crossingMs(
    crossingPlan({ id, hero, length: leads.deck, leadIn: leads.leadIn, leadOut: leads.leadOut, apexRise: 0.9, fast }),
  );
}

function stub(id: string) {
  const [from, to] = PAIRS[id]!;
  return { seq: 0, id, from, to, name: id, kind: 'ladder' as const, levels: LEVELS };
}

describe('bridge pairs (T42 6.1 / 6.5)', () => {
  it('Bridges_(NineLadders)_Should_BeTheT42SquarePairs', () => {
    expect(BRIDGE_PAIRS.map((p) => [p.id, p.from, p.to])).toEqual(
      Object.entries(PAIRS).map(([id, [from, to]]) => [id, from, to]),
    );
  });

  it('Bridges_(EveryLadderOfEveryLevel)_Should_HaveALayout', () => {
    const counts = LEVELS.map((level) => boardFor(level).ladders.length);
    expect(counts).toEqual([9, 7, 6]);
    for (const level of LEVELS)
      for (const ladder of boardFor(level).ladders) expect(bridgeById(ladder.id), ladder.id).toBeDefined();
  });

  it('Bridges_(Spec62Table)_Should_MatchLengthHeightOpeningsAndCrossedSquares', () => {
    for (const [id, spec] of Object.entries(SPEC)) {
      const bridge = bridgeById(id)!;
      expect(bridge.length * 56, `${id} L`).toBeCloseTo(spec.L, -1);
      expect(Math.abs(bridge.length * 56 - spec.L), `${id} L within 2 px`).toBeLessThan(2.5);
      expect(Math.abs(bridge.h * 56 - spec.h), `${id} h`).toBeLessThanOrEqual(1);
      expect(bridge.openings, `${id} openings`).toBe(spec.openings);
      expect([...bridge.crossed], `${id} crossed`).toEqual(spec.crossed);
    }
  });

  it('Deck_(Route)_Should_RunFromFootBackStripToTopSillAndBowAsSpecified', () => {
    const wedding = bridgeById('wedding')!;
    const [fx, fz] = squareCentre(26);
    const [tx, tz] = squareCentre(52);
    expect(wedding.foot).toEqual([fx, fz - 0.375]);
    expect(wedding.top[0]).toBeCloseTo(tx);
    expect(wedding.top[1]).toBeCloseTo(tz + 0.357);
    const straightMid = [(wedding.foot[0] + wedding.top[0]) / 2, (wedding.foot[1] + wedding.top[1]) / 2];
    expect(routeAt(wedding, 0.5)[1]).toBeCloseTo(straightMid[1]! - WEDDING_BOW); // a negative bow: toward the viewer
    const setu = bridgeById('rama-setu')!;
    const setuMid = [(setu.foot[0] + setu.top[0]) / 2, (setu.foot[1] + setu.top[1]) / 2];
    expect(routeAt(setu, 0.5)[1]).toBeCloseTo(setuMid[1]! - 0.21);
  });

  it('Deck_(Height)_Should_StartAndEndOnTheAbutmentTopsAndRiseTheSineHump', () => {
    for (const bridge of bridges().values()) {
      expect(deckHeightAt(bridge, 0), bridge.id).toBeCloseTo(blockTopY(bridge.from) + ABUTMENT_H);
      expect(deckHeightAt(bridge, 1), bridge.id).toBeCloseTo(blockTopY(bridge.to) + ABUTMENT_H);
      const mid = (bridge.baseFoot + bridge.baseTop) / 2 + bridge.h;
      expect(deckHeightAt(bridge, 0.5), bridge.id).toBeCloseTo(mid);
    }
  });

  it('WeddingDeck_(AtKaikeyi46)_Should_RunInFrontOfTheTokenLowAndFlat', () => {
    // owner, T44.14: lowered and flattened where it passes 46, and bowed in front of the token's field centre (the
    // vertex-level clearance against Kaikeyi's clips is in snakes3d.test.ts)
    const wedding = bridgeById('wedding')!;
    expect(wedding.h).toBe(WEDDING_HUMP);
    expect(wedding.h).toBeLessThan(0.39);
    const [cx, cz] = squareCentre(46);
    const near = wedding.deck.filter((p) => Math.abs(p.x - cx) < 0.46);
    expect(near.length).toBeGreaterThan(0);
    for (const p of near) {
      expect(p.z, 'in front of the block centre').toBeGreaterThan(cz);
      expect(Math.hypot(p.x - cx, p.z - cz), 'clear of the token on the field centre').toBeGreaterThan(0.4);
      expect(p.y - blockTopY(46), 'deck height over 46').toBeLessThan(0.3);
    }
  });

  it('RamaSetuBow_(Around114)_Should_KeepTheDeckBodyAboveTheCoilWhereItOverlapsInPlan', () => {
    // coil centre (cx, cz - 0.25) of the head block 114, outer radius 0.205 u, body 0.29 u tall (T44 5.2; the raised
    // head sits back-left, off the route). Where the deck body overlaps the coil in plan, its underside clears the coil.
    const setu = bridgeById('rama-setu')!;
    const [cx, cz] = squareCentre(114);
    const coilTop = blockTopY(114) + 0.29;
    // the upper turns shrink to r 0.17 (helix r_h -> r_h - 0.036), the ground spiral is 0.1 u tall at the full 0.205
    const upper = setu.deck.filter((p) => Math.hypot(p.x - cx, p.z - (cz - 0.25)) < 0.17 + BODY_WIDTH / 2);
    for (const p of upper) expect(p.y - CORE_THICKNESS, `upper turns, x ${p.x.toFixed(2)}`).toBeGreaterThanOrEqual(coilTop);
    const ground = setu.deck.filter((p) => Math.hypot(p.x - cx, p.z - (cz - 0.25)) < 0.205 + BODY_WIDTH / 2);
    for (const p of ground) expect(p.y - CORE_THICKNESS, `ground spiral, x ${p.x.toFixed(2)}`).toBeGreaterThanOrEqual(blockTopY(114) + 0.1);
    // and the bow is what keeps the centre line itself off the coil: it never passes over the coil centre
    const nearest = Math.min(...setu.deck.map((p) => Math.hypot(p.x - cx, p.z - (cz - 0.25))));
    expect(nearest).toBeGreaterThan(0.3);
  });

  it('Bridges_(AnyTwo)_Should_NeverOverlapInPlan', () => {
    const all = [...bridges().values()];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const gap = Math.min(
          ...all[i]!.deck.flatMap((a) => all[j]!.deck.map((b) => Math.hypot(a.x - b.x, a.z - b.z))),
        );
        expect(gap, `${all[i]!.id} vs ${all[j]!.id}`).toBeGreaterThan(BODY_WIDTH);
      }
  });

  it('SugrivaDeck_(OverRamaSetusFootAbutment101)_Should_NotTouchIt', () => {
    const sugriva = bridgeById('sugriva')!;
    const [cx, cz] = squareCentre(101);
    const rect = { x: ABUTMENT_WIDTH / 2, z: FOOT_ABUTMENT_DEPTH / 2, cz: cz - 0.375 };
    for (const p of sugriva.deck) {
      const hit = Math.abs(p.x - cx) < rect.x + BODY_WIDTH / 2 && Math.abs(p.z - rect.cz) < rect.z + BODY_WIDTH / 2;
      expect(hit, `sample at x ${p.x.toFixed(2)}`).toBe(false);
    }
  });
});

describe('crossing time (T44 6.5 totals)', () => {
  it('Vishwamitra_(Crossing)_Should_TakeAbout1730Ms', () => {
    expect(Math.abs(crossingTime('vishwamitra') - 1730)).toBeLessThanOrEqual(30);
  });

  it('Guha_(Crossing)_Should_TakeAbout1400MsAndShabariAbout540', () => {
    expect(Math.abs(crossingTime('guha') - 1400)).toBeLessThanOrEqual(50);
    expect(crossingTime('shabari')).toBe(540);
  });

  it('Vishwamitra_(FastCrossing)_Should_TakeAbout400Ms', () => {
    // T44.14: Fast steps and deck run twice as quick as spec 6.5's 810 ms
    expect(Math.abs(crossingTime('vishwamitra', true) - 400)).toBeLessThanOrEqual(30);
  });
});

describe('fade-when-behind (T44 6.4)', () => {
  const hanumanLeap = bridgeById('hanuman-leap')!;

  it('HanumanLeap_(TokenRestingOn119)_Should_FadeTheBridgeToThirtyFivePercent', () => {
    expect(hanumanLeap.crossed).toContain(119);
    expect(fadeTarget(hanumanLeap.crossed, [restingSpot(119, 0, 1)])).toBe(BEHIND_OPACITY);
  });

  it('Bridges_(TokenOn119)_Should_FadeOnlyTheBridgeWhoseDeckCrossesIt', () => {
    const faded = [...bridges().values()].filter((b) => fadeTarget(b.crossed, [restingSpot(119, 0, 1)]) < 1);
    expect(faded.map((b) => b.id)).toEqual(['hanuman-leap']);
  });

  it('Bridge_(TokenOnFootSquareOrTopSquare)_Should_StayOpaque', () => {
    expect(fadeTarget(hanumanLeap.crossed, [restingSpot(95, 0, 1)])).toBe(1);
    expect(fadeTarget(hanumanLeap.crossed, [restingSpot(122, 0, 1)])).toBe(1);
  });

  it('Bridge_(TokenOnFanSlotOfCrossedSquare)_Should_StillFade', () => {
    for (const count of [2, 3, 4])
      for (let slot = 0; slot < count; slot++)
        expect(fadeTarget(hanumanLeap.crossed, [restingSpot(119, slot, count)]), `${slot}/${count}`).toBe(BEHIND_OPACITY);
  });

  it('Opacity_(Fade)_Should_ReachTargetIn150MsAndReturnInTheSameTime', () => {
    let o = 1;
    for (let t = 0; t < FADE_MS; t += 10) o = stepOpacity(o, BEHIND_OPACITY, 10);
    expect(o).toBeCloseTo(BEHIND_OPACITY);
    for (let t = 0; t < FADE_MS; t += 10) o = stepOpacity(o, 1, 10);
    expect(o).toBeCloseTo(1);
  });

  it('FieldCentre_(Distance)_Should_UseTheStandingFieldOfTheSquare', () => {
    const [x, y] = fieldCentre(119);
    expect(fadeTarget(hanumanLeap.crossed, [[x + CELL * 0.5, y]])).toBe(1);
  });
});

describe('rise (T44 6.4)', () => {
  it('Rise_(Chunks)_Should_StartOneAfterAnotherFootToTopWithin570Ms', () => {
    expect(riseTotalMs(4)).toBe(570);
    expect(chunkProgress(0.2, 0, 4)).toBeGreaterThan(chunkProgress(0.2, 1, 4));
    expect(chunkProgress(0.2, 3, 4)).toBe(0);
    expect(chunkProgress(1, 3, 4)).toBe(1);
  });

  it('Rise_(EasedViewValue)_Should_InvertToTheLinearClock', () => {
    for (const u of [0, 0.25, 0.5, 0.9, 1]) expect(riseClock(0.5 - Math.cos(u * Math.PI) / 2)).toBeCloseTo(u);
  });

  it('BackOut_(Ends)_Should_StartAtZeroOvershootAndSettleAtOne', () => {
    expect(backOut(0)).toBeCloseTo(0);
    expect(backOut(1)).toBeCloseTo(1);
    expect(Math.max(...Array.from({ length: 50 }, (_, i) => backOut(i / 49)))).toBeGreaterThan(1.05);
  });

  it('Thud_(StandingBridge)_Should_SwellToOnePointZeroThreeAndSettle', () => {
    expect(thudScale(60)).toBeCloseTo(1.03);
    expect(thudScale(0)).toBe(1);
    expect(thudScale(200)).toBe(1);
  });
});

describe('deck surface and crossing path agree', () => {
  it('RunPath_(Deck)_Should_StayWithinOneMillimetreOfTheDeckSamplesTheGlbIsBuiltFrom', () => {
    for (const bridge of bridges().values()) {
      const path = bridgeCurve(stub(bridge.id));
      const { leadIn, deck } = bridgeLeads(path);
      expect(deck, bridge.id).toBeCloseTo(bridge.deckLength, 6);
      // sample the run at 40 points: each lies on a segment between consecutive deck samples (same polyline)
      for (let k = 0; k <= 40; k++) {
        const point = path.getPointAt((leadIn + (bridge.deckLength * k) / 40) / path.getLength());
        const onDeck = bridge.deck.some((p, i) => {
          const q = bridge.deck[i + 1];
          if (!q) return false;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((point.x - p.x) * (q.x - p.x) + (point.y - p.y) * (q.y - p.y) + (point.z - p.z) * (q.z - p.z)) /
                ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2),
            ),
          );
          return Math.hypot(point.x - (p.x + (q.x - p.x) * t), point.y - (p.y + (q.y - p.y) * t), point.z - (p.z + (q.z - p.z) * t)) < 1e-3;
        });
        expect(onDeck, `${bridge.id} ${k}`).toBe(true);
      }
    }
  });

  it('Path_(Ends)_Should_StartAndEndOnTheStandingFieldsOfTheFootAndTopSquares', () => {
    for (const bridge of bridges().values()) {
      const path = bridgeCurve(stub(bridge.id));
      const [fx, fy] = fieldCentre(bridge.from);
      const start = path.getPointAt(0);
      expect(start.x).toBeCloseTo((fx - 336) / 56);
      expect(start.z).toBeCloseTo((fy - 336) / 56);
      const [tx, ty] = fieldCentre(bridge.to);
      const end = path.getPointAt(1);
      expect(end.x).toBeCloseTo((tx - 336) / 56);
      expect(end.z).toBeCloseTo((ty - 336) / 56);
    }
  });

  it('Manifest_(DeckRaysOffTheBuiltMesh)_Should_MatchTheDeckFormula', () => {
    type Entry = { deckRays: ([number, number, number] | null)[] };
    for (const [id, entry] of Object.entries(manifest as unknown as Record<string, Entry>)) {
      const rays = entry.deckRays.slice(1, -1).filter((ray): ray is [number, number, number] => ray !== null);
      expect(rays.length, id).toBeGreaterThan(0);
      const errors = rays.map(([, formula, measured]) => measured - formula);
      // the abutment ends and a few interior spots carry ornaments (higher), a seam can read 12 mm low: never lower
      // (the short, steep shabari hump bends 25 mm away from its flat flagstones; the others stay within 15)
      expect(Math.min(...errors), id).toBeGreaterThan(-0.03);
      const sorted = errors.map(Math.abs).sort((a, b) => a - b);
      if (id !== 'shabari') expect(sorted[Math.floor(sorted.length / 2)]!, `${id} median`).toBeLessThan(0.006);
    }
  });

  it('Glb_(PositionBounds)_Should_CoverTheDeckAndTheHumpApex', () => {
    for (const bridge of bridges().values()) {
      const file = readFileSync(`public/models/bridges/${bridge.id}.glb`);
      const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
      const jsonLength = view.getUint32(12, true);
      const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength))) as {
        accessors: { min?: number[]; max?: number[]; type: string }[];
        meshes: { primitives: { attributes: Record<string, number> }[] }[];
      };
      const position = json.accessors[json.meshes[0]!.primitives[0]!.attributes.POSITION!]!;
      const apex = Math.max(...bridge.deck.map((p) => p.y));
      expect(position.max![1]!, `${bridge.id} top`).toBeGreaterThanOrEqual(apex);
      expect(position.max![1]!, `${bridge.id} top`).toBeLessThan(apex + 0.4);
      for (const p of bridge.deck) {
        expect(p.x).toBeGreaterThanOrEqual(position.min![0]!);
        expect(p.x).toBeLessThanOrEqual(position.max![0]!);
        expect(p.z).toBeGreaterThanOrEqual(position.min![2]!);
        expect(p.z).toBeLessThanOrEqual(position.max![2]!);
      }
    }
  });

  it('Deck_(Samples)_Should_BeDivisibleSoEveryPierFallsOnASample', () => {
    for (const n of [1, 2, 3, 4]) expect(DECK_SAMPLES % n).toBe(0);
  });
});

describe('budgets (T44 6.2 / 10)', () => {
  type Entry = { tris: number; bytes: number };
  const entries = Object.entries(manifest as unknown as Record<string, Entry>);

  it('Bridges_(Manifest)_Should_ListAllNine', () => {
    expect(entries.map(([id]) => id).sort()).toEqual(Object.keys(PAIRS).sort());
  });

  it('Bridges_(EachGlb)_Should_StayUnder3000TrisAnd60Kb', () => {
    for (const [id, entry] of entries) {
      expect(entry.tris, `${id} tris`).toBeLessThanOrEqual(3000);
      expect(entry.bytes, `${id} bytes`).toBeLessThanOrEqual(60 * 1024);
    }
  });

});
