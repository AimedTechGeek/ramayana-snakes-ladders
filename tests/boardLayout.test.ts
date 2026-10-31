import { describe, expect, it } from 'vitest';
import { fieldCentre } from '../src/game/iso/boardIso';
import { toThree, waitingSpot } from '../src/app/board3d/coords';
import {
  LEDGE,
  PLINTH_TOP_Y,
  TRAY_ANCHOR,
  VARIANT_NAMES,
  WATER_LIFT,
  blockHeight,
  blockTopY,
  chipAnchor,
  groundHeightAt,
  squareCentre,
  squaresByVariant,
  variantOf,
} from '../src/app/board3d/boardLayout';
import { regionOf } from '../src/game/board/blockRules';

const squares = Array.from({ length: 144 }, (_, i) => i + 1);

describe('block heights (spec 2.3)', () => {
  const heightsOf = (region: string) => squares.filter((s) => regionOf(s) === region).map(blockHeight);

  it('MithilaBlocks_Should_StandAt022', () =>
    heightsOf('mithila').forEach((h) => expect(h).toBeCloseTo(0.22)));
  it('AyodhyaBlocks_Should_StandAt026', () =>
    heightsOf('ayodhya').forEach((h) => expect(h).toBeCloseTo(0.26)));
  it('GangaBlocks_Should_StandAt016', () => heightsOf('ganga').forEach((h) => expect(h).toBeCloseTo(0.16)));
  it('SeaBlocks_Should_StandAt014', () => heightsOf('sea').forEach((h) => expect(h).toBeCloseTo(0.14)));
  it('DandakaBlocks_Should_VaryWithinPlusMinus002', () => {
    heightsOf('dandaka').forEach((h) => expect(Math.abs(h - 0.22)).toBeLessThanOrEqual(0.02 + 1e-9));
    expect(new Set(heightsOf('dandaka').map((h) => h.toFixed(2))).size).toBeGreaterThan(1);
  });
  it('KishkindhaBlocks_Should_VaryInTwoHundredthsStepsWithinPlusMinus004', () => {
    heightsOf('kishkindha').forEach((h) => {
      expect(Math.abs(h - 0.3)).toBeLessThanOrEqual(0.04 + 1e-9);
      expect(Math.abs(Math.round((h - 0.3) / 0.02) * 0.02 - (h - 0.3))).toBeLessThan(1e-9);
    });
  });
  it('LankaRows11And12_Should_RiseToTheThrone', () => {
    expect(blockHeight(125)).toBeCloseTo(0.32);
    expect(blockHeight(140)).toBeCloseTo(0.38);
  });
  it('WaterBlocks_Should_CarryTheirSurfaceOneHundredthAboveTheBed', () => {
    expect(blockTopY(49)).toBeCloseTo(0.16 + WATER_LIFT);
    expect(blockTopY(112)).toBeCloseTo(0.14 + WATER_LIFT);
    expect(blockTopY(5)).toBeCloseTo(0.22);
  });
});

describe('block variants (spec 2.1)', () => {
  it('TheBoard_Should_UseFourteenVariantsAndEverySquareExactlyOnce', () => {
    expect(VARIANT_NAMES).toHaveLength(14);
    const all = [...squaresByVariant().values()].flat().sort((a, b) => a - b);
    expect(all).toEqual(squares);
  });
  it('EveryVariant_Should_BeUsedBySomeSquare', () => {
    for (const [name, list] of squaresByVariant()) expect(list.length, name).toBeGreaterThan(0);
  });
  it('ASquare_Should_UseAVariantOfItsOwnRegion', () => {
    squares.forEach((s) => expect(variantOf(s).startsWith(regionOf(s) + '-')).toBe(true));
  });
});

describe('square centres', () => {
  it('Square1_Should_StandAtTheFrontLeftCorner', () => expect(squareCentre(1)).toEqual([-5.5, 5.5]));
  it('Square12_Should_EndTheFrontRowOnTheRight', () => expect(squareCentre(12)).toEqual([5.5, 5.5]));
  it('Square13_Should_StartTheSecondRowOnTheRight', () => expect(squareCentre(13)).toEqual([5.5, 4.5]));
  it('Square144_Should_SitInTheBackLeftCorner', () => expect(squareCentre(144)).toEqual([-5.5, -5.5]));
});

describe('tokens stand on block tops (coords.ts)', () => {
  it('AFieldCentre_Should_MapToTheBlockTopHeightOfItsSquare', () => {
    // The standing-field centre sits 9/56 u behind the block centre, well inside the plateau of the block.
    for (const square of squares) {
      const [, y] = toThree(fieldCentre(square));
      expect(y, `square ${square}`).toBeCloseTo(blockTopY(square), 6);
    }
  });
  it('ALift_Should_RaiseThePointAboveTheGround', () => {
    expect(toThree(fieldCentre(49), 0.3)[1]).toBeCloseTo(blockTopY(49) + 0.3);
  });
  it('AWaitingSeat_Should_StandOnTheFrontRimStripAtFieldLevel', () => {
    for (let seat = 0; seat < 4; seat++) {
      const [x, y, z] = toThree(waitingSpot(seat));
      expect(y).toBe(0);
      expect(z).toBeGreaterThan(6.0);
      expect(z).toBeLessThan(6.3);
      expect(Math.abs(x)).toBeLessThan(6);
    }
  });
});

describe('groundHeightAt', () => {
  it('AcrossAGroove_Should_RampSmoothlyBetweenNeighbouringBlockTops', () => {
    // 36 is the last mithila square (0.22) and 37 the first ayodhya square (0.26), one row behind it.
    const [x37, z37] = squareCentre(37);
    const [x36, z36] = squareCentre(36);
    expect(x37).toBeCloseTo(x36);
    expect(z37).toBeCloseTo(z36 - 1);
    expect(groundHeightAt(x37, z37)).toBeCloseTo(0.26);
    expect(groundHeightAt(x36, z36)).toBeCloseTo(0.22);
    const edge = groundHeightAt(x37, z37 + 0.5);
    expect(edge).toBeGreaterThan(0.22);
    expect(edge).toBeLessThan(0.26);
  });
  it('OnTheRimStrip_Should_BeFieldLevel', () => expect(groundHeightAt(0, 6.15)).toBe(0));
  it('BeyondTheSlab_Should_BeThePlinthTop', () => expect(groundHeightAt(7.5, 5.8)).toBe(PLINTH_TOP_Y));
});

describe('mount points for the die and tray (spec 7.2)', () => {
  it('TheTrayAnchor_Should_SitOnTheOakLedgeAtThePlinthTop', () => {
    expect(TRAY_ANCHOR[0]).toBeGreaterThan(LEDGE.x0);
    expect(TRAY_ANCHOR[0]).toBeLessThan(LEDGE.x1);
    expect(TRAY_ANCHOR[2]).toBeGreaterThan(LEDGE.z0);
    expect(TRAY_ANCHOR[2]).toBeLessThan(LEDGE.z1);
    expect(TRAY_ANCHOR[1]).toBe(PLINTH_TOP_Y);
  });
});

describe('square-number chips (spec 2.8)', () => {
  it('AChip_Should_PinAtTheFrontLeftCornerOneTenthAboveAndFiveHundredthsInside', () => {
    const [cx, cz] = squareCentre(7);
    const [x, y, z] = chipAnchor(7);
    expect(x).toBeCloseTo(cx - 0.41);
    expect(z).toBeCloseTo(cz + 0.41);
    expect(y).toBeCloseTo(blockTopY(7) + 0.1);
  });
  it('AChipOnABridgeTop_Should_MoveToTheFrontRightCorner', () => {
    const [cx] = squareCentre(7);
    expect(chipAnchor(7, true)[0]).toBeCloseTo(cx + 0.41);
  });
  it('EveryChip_Should_StayAboveItsBlockTop', () => {
    squares.forEach((s) => expect(chipAnchor(s)[1]).toBeGreaterThan(blockTopY(s)));
  });
});
