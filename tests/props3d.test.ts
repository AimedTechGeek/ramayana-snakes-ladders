import { describe, expect, it } from 'vitest';
import {
  BACK_MAX_HEIGHT,
  STRIP,
  layoutProps,
  randomKindsOf,
  regionOf,
  seedOf,
  type RegionName,
} from '../src/game/board/blockRules';
import {
  BIRD_ROUTES,
  CATALOG,
  CORONATION,
  MANIFEST_KINDS,
  PROP_LAYOUT,
  activeSquares,
  ambientFeatures,
  birdPose,
  fanSlots,
  layoutInstances,
  underCanopy,
} from '../src/app/board3d/propLayout';
import manifest from '../src/app/board3d/propsManifest.json';

const SQUARES = Array.from({ length: 144 }, (_, i) => i + 1);
const REGIONS: RegionName[] = ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'];
const kindsOn = (square: number) => PROP_LAYOUT[square]!.map((p) => p.kind);
const heightOf = (kind: string) => CATALOG.find((k) => k.kind === kind)!.height;
const isLandmark = (square: number) => CATALOG.some((k) => k.squares?.includes(square));

describe('prop pack manifest', () => {
  it('PropPack_(AllKinds)_Should_HaveAtLeastFiftyKinds', () => {
    expect(Object.values(MANIFEST_KINDS).filter((k) => !k.fly).length).toBeGreaterThanOrEqual(50);
  });

  it('PropPack_(EveryKind)_Should_StayWithinItsTriangleBudget', () => {
    for (const kind of Object.values(MANIFEST_KINDS))
      expect(kind.tris, kind.kind).toBeLessThanOrEqual(kind.budget);
  });

  it('PropPack_(PropKinds)_Should_BeAtMostTwentyTwoPixelsTall', () => {
    for (const kind of CATALOG.filter((k) => !k.landmark))
      expect(kind.height / 56, kind.kind).toBeLessThanOrEqual(22 / 56 + 0.002);
  });

  it('PropPack_(GlbFiles)_Should_FitTheDownloadBudgets', () => {
    expect(manifest.bytes['props.glb']).toBeLessThanOrEqual(450 * 1024);
    expect(manifest.bytes['landmarks.glb']).toBeLessThanOrEqual(400 * 1024);
  });

  it('PropPack_(EveryRegion)_Should_HaveAtLeastSixRandomKinds', () => {
    for (const region of REGIONS)
      expect(randomKindsOf(region, CATALOG).length, region).toBeGreaterThanOrEqual(6);
  });

  it('PropPack_(Manifest)_Should_ListBirdsAndButterfliesAsFlyingKinds', () => {
    expect(manifest.kinds.bird.fly).toBe(true);
    expect(manifest.kinds.butterfly.fly).toBe(true);
  });
});

describe('prop placement per seed rule (identical to T42)', () => {
  it('Props_(SameCatalog)_Should_EqualTheT42LayoutRule', () => {
    expect(PROP_LAYOUT).toEqual(layoutProps(CATALOG));
  });

  it('Props_(EverySquare)_Should_HaveOneToThreePropsOfItsRegionOrItsLandmark', () => {
    for (const square of SQUARES) {
      expect(PROP_LAYOUT[square]!.length).toBeGreaterThanOrEqual(1);
      expect(PROP_LAYOUT[square]!.length).toBeLessThanOrEqual(3);
      for (const placed of PROP_LAYOUT[square]!) {
        const kind = MANIFEST_KINDS[placed.kind]!;
        expect(
          kind.regions.includes(regionOf(square)) || kind.squares?.includes(square),
          `${placed.kind} on ${square}`,
        ).toBe(true);
      }
    }
  });

  it('Props_(FirstProp)_Should_StandOnTheSideStripChosenByTheSeedBit', () => {
    for (const square of SQUARES) {
      const first = PROP_LAYOUT[square]![0]!;
      const left = ((seedOf(square) >>> 17) & 1) === 1;
      expect(Math.sign(first.x), `square ${square}`).toBe(left ? -1 : 1);
      expect(Math.abs(first.x)).toBe(STRIP.sideX);
    }
  });

  it('Props_(SecondRandomProp)_Should_TakeTheBackStripWhenLowElseTheOtherSide', () => {
    for (const square of SQUARES) {
      const props = PROP_LAYOUT[square]!;
      if (props.length !== 2 || isLandmark(square)) continue;
      const [first, second] = props as [(typeof props)[0], (typeof props)[0]];
      if (heightOf(second.kind) <= BACK_MAX_HEIGHT) expect(second.y, `square ${square}`).toBe(STRIP.backY);
      else expect(Math.sign(second.x), `square ${square}`).toBe(-Math.sign(first.x));
    }
  });

  it('Props_(NeighbourSquares)_Should_NotRepeatTheFirstKind', () => {
    for (const square of SQUARES.slice(1))
      expect(PROP_LAYOUT[square]![0]!.kind, `square ${square}`).not.toBe(PROP_LAYOUT[square - 1]![0]!.kind);
  });

  it('Props_(AnyProp)_Should_StayOffTheStandingFieldCore', () => {
    for (const square of SQUARES)
      for (const p of PROP_LAYOUT[square]!) {
        if (p.kind === 'dais') continue;
        expect(Math.abs(p.x) < 16 && p.y > -22 && p.y < 4, `${p.kind} on ${square}`).toBe(false);
      }
  });

  it('Landmarks_(FixedSquares)_Should_CarryTheirKinds', () => {
    expect(kindsOn(1)).toContain('ayodhya-threshold');
    expect(kindsOn(24)).toContain('sage-hut');
    expect(kindsOn(36)).toContain('janaka-palace');
    expect(kindsOn(66)).toContain('panchavati-hut');
    expect(kindsOn(85)).toEqual(expect.arrayContaining(['basket', 'berry-bush']));
    expect(kindsOn(90)).toContain('cave-mouth');
    expect(kindsOn(96)).toContain('waterfall');
    expect(kindsOn(97)).toContain('hill');
    expect(kindsOn(137)).toContain('broken-banner');
    expect(kindsOn(144)).toContain('dais');
    for (const ganga of [49, 50, 71, 72, 73, 74]) expect(kindsOn(ganga)).toContain('reed');
  });

  it('Props_(RenderedInstances)_Should_LeaveSquare144ToTheCoronationAndLandmarksToTheirOwnMeshes', () => {
    const instances = layoutInstances();
    expect(instances.some((i) => i.square === 144)).toBe(false);
    expect(instances.some((i) => MANIFEST_KINDS[i.kind]!.landmark)).toBe(false);
    expect(instances.length).toBeGreaterThan(144);
  });

  it('Props_(LampAndFireCounts)_Should_PlaceFewerThanTwentyFiveLampsAndTwoFires', () => {
    const count = (kind: string) => layoutInstances().filter((i) => i.kind === kind).length;
    expect(count('lamp') + count('gold-lamp')).toBeLessThanOrEqual(24);
    expect(count('fire')).toBe(2);
  });
});

describe('coronation at 144', () => {
  it('Chhatra_(AnyTokenFanSlot)_Should_NotStandUnderTheCanopy', () => {
    for (const [x, z] of fanSlots()) expect(underCanopy(x, z, 0.05), `slot ${x},${z}`).toBe(false);
  });

  it('Chhatra_(Canopy)_Should_SitBehindTheThroneOnTheRimNotOverTheDaisCentre', () => {
    expect(CORONATION.pole[1]).toBeLessThan(CORONATION.throne[1]);
    expect(CORONATION.pole[1]).toBeLessThan(-0.5);
    expect(underCanopy(0, 0)).toBe(false);
  });
});

describe('ambient life', () => {
  it('Ambient_(ReducedMotion)_Should_SwitchEveryAnimationOff', () => {
    expect(Object.values(ambientFeatures(true)).every((on) => !on)).toBe(true);
    expect(Object.values(ambientFeatures(false)).every((on) => on)).toBe(true);
  });

  it('Ambient_(Culling)_Should_KeepOnlyRevealedSquaresInView', () => {
    const active = activeSquares(new Set([1, 2, 3, 144]), (s) => s !== 2);
    expect([...active].sort((a, b) => a - b)).toEqual([1, 3, 144]);
  });

  it('Birds_(OneLoop)_Should_ReturnToTheirStartAfterFourteenSeconds', () => {
    for (const route of BIRD_ROUTES) {
      const a = birdPose(route, 0);
      const b = birdPose(route, 14);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.z).toBeCloseTo(a.z, 6);
    }
    expect(BIRD_ROUTES.length).toBeLessThanOrEqual(5);
  });
});
