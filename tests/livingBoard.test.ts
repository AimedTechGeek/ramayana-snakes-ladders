import { describe, expect, it } from 'vitest';
import * as node from '../scripts/art/iso/blocks.mjs';
import { framePlacements, frameFixtures } from '../scripts/art/iso/frame.mjs';
import propsMeta from '../public/assets/iso/props.meta.json';
import frameMeta from '../public/assets/iso/frame.meta.json';
import {
  AMBIENT_LIMIT,
  BAND,
  FLOOR_OFFSET,
  NUMERAL_DEPTH,
  airDepth,
  floorDepth,
  floorKey,
  frameDepth,
  selectAmbient,
  snakeHeadDepth,
  standingDepth,
} from '../src/game/board/boardBands';
import {
  BACK_MAX_HEIGHT,
  REGION_INK,
  STRIP,
  fogFrameOf,
  frameNameOf,
  layoutProps,
  patternOf,
  propCountOf,
  randomKindsOf,
  regionOf,
  seedOf,
  tileTintOf,
  type PropKind,
  type RegionName,
} from '../src/game/board/blockRules';
import { CELL, SIZE } from '../src/game/iso/world';
import { gridOf } from '../src/game/layout';

const SQUARES = Array.from({ length: 144 }, (_, i) => i + 1);
const catalog = Object.values(propsMeta.frames) as unknown as PropKind[];
const layout = layoutProps(catalog);
const heightOf = (kind: string) => catalog.find((k) => k.kind === kind)!.height;
const isLandmark = (square: number) => catalog.some((k) => k.squares?.includes(square));

describe('block rules twin (TS vs scripts/art/iso/blocks.mjs)', () => {
  it('BlockRules_(All144Squares)_Should_AgreeWithTheNodeTwin', () => {
    for (const square of SQUARES) {
      expect(seedOf(square), `seed ${square}`).toBe(node.seedOf(square));
      expect(patternOf(square), `pattern ${square}`).toBe(node.patternOf(square));
      expect(propCountOf(square), `count ${square}`).toBe(node.propCountOf(square));
      expect(regionOf(square), `region ${square}`).toBe(node.regionOf(square));
      expect(frameNameOf(square), `frame ${square}`).toBe(node.frameNameOf(square));
    }
  });

  it('BlockRules_(RegionInk)_Should_MatchTheNodeRegionTable', () => {
    for (const [region, ink] of Object.entries(REGION_INK)) expect(node.REGIONS[region]!.ink).toBe(ink);
  });

  it('FogFrame_(AnySquare)_Should_BeItsRegionFogFrame', () => {
    expect(fogFrameOf(49)).toBe('ganga-fog');
    expect(fogFrameOf(130)).toBe('lanka-fog');
  });
});

describe('tile tint', () => {
  const evenSquareOfRow = (row: number) =>
    SQUARES.find((s) => {
      const grid = gridOf(s);
      return grid.row + 1 === row && regionOf(s) === 'dandaka' && (grid.row + grid.column) % 2 === 0;
    })!;

  it('TileTint_(OddRowPlusColumn)_Should_BeSixPercentDarkerThanEven', () => {
    expect(new Set([1, 2].map(tileTintOf))).toEqual(new Set([0xffffff, 0xf0f0f0]));
  });

  it('TileTint_(DandakaRows)_Should_DeepenFromRowFiveToSeven', () => {
    expect(tileTintOf(evenSquareOfRow(5))).toBe(0xffffff);
    expect(tileTintOf(evenSquareOfRow(6))).toBe(0xebebeb);
    expect(tileTintOf(evenSquareOfRow(7))).toBe(0xd8d8d8);
  });
});

describe('prop placement per seed rule', () => {
  it('Props_(EveryRegion)_Should_HaveAtLeastSixRandomKinds', () => {
    for (const region of Object.keys(REGION_INK))
      expect(randomKindsOf(region as RegionName, catalog).length).toBeGreaterThanOrEqual(6);
  });

  it('Props_(EverySquare)_Should_HaveOneToThreeProps', () => {
    for (const square of SQUARES) {
      expect(layout[square]!.length, `square ${square}`).toBeGreaterThanOrEqual(1);
      expect(layout[square]!.length, `square ${square}`).toBeLessThanOrEqual(3);
    }
  });

  it('Props_(EverySquare)_Should_UseKindsOfItsRegionOrItsOwnLandmarks', () => {
    for (const square of SQUARES) {
      const region = regionOf(square);
      for (const placed of layout[square]!) {
        const kind = catalog.find((k) => k.kind === placed.kind)!;
        expect(
          kind.regions.includes(region) || kind.squares?.includes(square),
          `${placed.kind} on ${square}`,
        ).toBe(true);
      }
    }
  });

  it('Props_(FirstProp)_Should_StandOnTheSideStripChosenByTheSeedBit', () => {
    for (const square of SQUARES) {
      const first = layout[square]![0]!;
      const left = ((seedOf(square) >>> 17) & 1) === 1;
      expect(Math.sign(first.x), `square ${square}`).toBe(left ? -1 : 1);
      expect(Math.abs(first.x)).toBe(STRIP.sideX);
    }
  });

  it('Props_(SecondRandomProp)_Should_TakeTheBackStripWhenLowElseTheOtherSide', () => {
    for (const square of SQUARES) {
      const props = layout[square]!;
      if (props.length !== 2 || isLandmark(square)) continue;
      const [first, second] = props as [(typeof props)[0], (typeof props)[0]];
      if (heightOf(second.kind) <= BACK_MAX_HEIGHT) expect(second.y, `square ${square}`).toBe(STRIP.backY);
      else expect(Math.sign(second.x), `square ${square}`).toBe(-Math.sign(first.x));
    }
  });

  it('Props_(NeighbourSquares)_Should_NotRepeatTheFirstKind', () => {
    for (const square of SQUARES.slice(1))
      expect(layout[square]![0]!.kind, `square ${square}`).not.toBe(layout[square - 1]![0]!.kind);
  });

  it('Props_(LandmarkSquares)_Should_CarryTheirFixedKinds', () => {
    const kindsOn = (square: number) => layout[square]!.map((p) => p.kind);
    expect(kindsOn(1)).toContain('ayodhya-threshold');
    expect(kindsOn(24)).toContain('sage-hut');
    expect(kindsOn(36)).toContain('janaka-palace');
    expect(kindsOn(66)).toContain('panchavati-hut');
    expect(kindsOn(90)).toContain('cave-mouth');
    expect(kindsOn(96)).toContain('waterfall');
    expect(kindsOn(144)).toContain('dais');
    for (const ganga of [49, 50, 71, 72, 73, 74]) expect(kindsOn(ganga)).toContain('reed');
  });

  it('Props_(SameCatalog)_Should_GiveTheSameLayoutOnEveryCall', () => {
    expect(layoutProps(catalog)).toEqual(layout);
  });

  it('Props_(AnyProp)_Should_StayOffTheStandingFieldCore', () => {
    for (const square of SQUARES)
      for (const p of layout[square]!) {
        if (p.kind === 'dais') continue;
        expect(Math.abs(p.x) < 16 && p.y > -22 && p.y < 4, `${p.kind} on ${square}`).toBe(false);
      }
  });
});

describe('depth bands', () => {
  const keys = SQUARES.map((square) => {
    const { row, column } = gridOf(square);
    return floorKey(column * CELL + CELL / 2, SIZE - row * CELL - CELL / 2);
  });

  it('Bands_(FloorStandingAirNumerals)_Should_SortFloorBelowStandingBelowNumerals', () => {
    expect(floorDepth(Math.max(...keys), 'shadow')).toBeLessThan(standingDepth(Math.min(...keys)));
    expect(standingDepth(Math.max(...keys))).toBeLessThan(airDepth(Math.min(...keys)));
    expect(snakeHeadDepth(Math.max(...keys))).toBeLessThan(NUMERAL_DEPTH);
    expect(NUMERAL_DEPTH).toBe(BAND.numerals);
  });

  it('Bands_(FloorParts)_Should_StackTileFogShimmerMistShadowInOrder', () => {
    const order = ['tile', 'fog', 'shimmer', 'mist', 'shadow'] as const;
    const depths = order.map((part) => floorDepth(keys[0]!, part));
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });

  it('Bands_(EdgeNeighbours)_Should_DifferByMoreThanTheMistOffsetSoTheNearerFogCoversTheFartherMist', () => {
    const keyAt = (row: number, column: number) =>
      floorKey(column * CELL + CELL / 2, SIZE - row * CELL - CELL / 2);
    for (let row = 0; row < 12; row++)
      for (let column = 0; column < 12; column++) {
        if (column < 11)
          expect(Math.abs(keyAt(row, column + 1) - keyAt(row, column))).toBeGreaterThan(FLOOR_OFFSET.mist);
        if (row < 11)
          expect(Math.abs(keyAt(row + 1, column) - keyAt(row, column))).toBeGreaterThan(FLOOR_OFFSET.mist);
      }
  });

  it('Bands_(SnakeHead)_Should_SortJustAboveItsCoil', () => {
    expect(snakeHeadDepth(300) - standingDepth(300)).toBe(0.5);
  });

  it('Bands_(FrameModules)_Should_FollowTheMetaRule', () => {
    const all = [...framePlacements(), ...frameFixtures()];
    expect(all).toHaveLength(frameMeta.placements.length + frameMeta.fixtures.length);
    const gate = all.find((p) => p.frame === 'gate')!;
    const rim = all.find((p) => p.frame === 'rim-back')!;
    const plate = all.find((p) => p.frame === 'plate-maker')!;
    expect(frameDepth(gate)).toBeGreaterThanOrEqual(BAND.standing);
    expect(frameDepth(rim)).toBeLessThan(BAND.standing);
    expect(frameDepth(plate)).toBe(floorKey(plate.depthAt[0], plate.depthAt[1]) + plate.depthBias);
  });
});

describe('ambient cull selection', () => {
  const view = { x: 100, y: 100, width: 200, height: 200 };
  const at = (id: number, x: number, y: number, cost = 1) => ({ id, x, y, cost });

  it('Cull_(SourceFarOutsideTheView)_Should_NotAnimate', () => {
    expect([...selectAmbient([at(1, 200, 200), at(2, 900, 900)], view)]).toEqual([1]);
  });

  it('Cull_(SourceOneTileOutside)_Should_StillAnimate', () => {
    expect(selectAmbient([at(1, 330, 200)], view, 60).has(1)).toBe(true);
    expect(selectAmbient([at(1, 361, 200)], view, 60).has(1)).toBe(false);
  });

  it('Cull_(MoreThanTheLimit)_Should_PauseTheFarthestFromTheViewCentreFirst', () => {
    const sources = Array.from({ length: 200 }, (_, i) =>
      at(i, 200 + (i % 20) * 3, 200 + Math.floor(i / 20) * 3),
    );
    const chosen = selectAmbient(sources, view);
    expect(chosen.size).toBe(AMBIENT_LIMIT);
    const dist = (id: number) => Math.hypot(sources[id]!.x - 200, sources[id]!.y - 200);
    const worstChosen = Math.max(...[...chosen].map(dist));
    const bestDropped = Math.min(...sources.filter((s) => !chosen.has(s.id)).map((s) => dist(s.id)));
    expect(worstChosen).toBeLessThanOrEqual(bestDropped);
  });

  it('Cull_(CostlyItem)_Should_CountItsTweensAgainstTheLimit', () => {
    const chosen = selectAmbient([at(1, 200, 200, 119), at(2, 201, 200, 2), at(3, 202, 200, 1)], view);
    expect([...chosen].sort()).toEqual([1, 3]);
  });
});
