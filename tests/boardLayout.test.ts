import { describe, expect, it } from 'vitest';
import { fieldCentre } from '../src/game/iso/boardIso';
import { toThree, waitingSpot } from '../src/app/board3d/coords';
import {
  LEDGE,
  PLINTH_TOP_Y,
  ROW_END_STAIRS,
  SEA_BED,
  STAIR_HALF_WIDTH,
  TRAY_ANCHOR,
  TRAY_BASE,
  VARIANT_NAMES,
  WATER_LIFT,
  blockHeight,
  blockTopY,
  chipAnchor,
  groundHeightAt,
  rowOf,
  squareCentre,
  squaresByVariant,
  terraceY,
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
  // T45.1: the sea bed rose from 0.14 so the sea row, one terrace up, clears Kishkindha's highest block in front of it
  it('SeaBlocks_Should_StandAt022AboveTheirTerrace', () => {
    expect(SEA_BED).toBe(0.22);
    heightsOf('sea').forEach((h) => expect(h).toBeCloseTo(SEA_BED));
  });
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
    expect(blockTopY(49)).toBeCloseTo(terraceY(4) + 0.16 + WATER_LIFT);
    expect(blockTopY(112)).toBeCloseTo(terraceY(9) + SEA_BED + WATER_LIFT);
    expect(blockTopY(5)).toBeCloseTo(0.22);
  });
});

describe('terraces (T45.1)', () => {
  const rows = Array.from({ length: 12 }, (_, row) => squares.filter((s) => rowOf(s) === row).map(blockTopY));

  it('TheFrontRow_Should_StandOnTheFieldPlate', () => expect(terraceY(0)).toBe(0));
  it('EveryRow_Should_RiseBetween012And015AboveTheRowInFront', () => {
    for (let row = 1; row < 12; row++) {
      const rise = terraceY(row) - terraceY(row - 1);
      expect(rise, `row ${row}`).toBeGreaterThanOrEqual(0.12);
      expect(rise, `row ${row}`).toBeLessThanOrEqual(0.15);
    }
  });
  it('EveryRowsLowestBlock_Should_StandAboveThePreviousRowsHighest', () => {
    for (let row = 1; row < 12; row++)
      expect(Math.min(...rows[row]!), `row ${row}`).toBeGreaterThan(Math.max(...rows[row - 1]!));
  });
  it('TheThrone_Should_StandAtTheTopOfTheClimb', () => {
    expect(Math.max(...squares.map(blockTopY))).toBe(blockTopY(144));
  });
});

describe('row-end stairs (T45.1)', () => {
  it('EveryRowTurn_Should_HaveAStairOnTheColumnItTurnsOn', () => {
    expect(ROW_END_STAIRS.map((s) => [s.lower, s.upper])).toEqual(
      Array.from({ length: 11 }, (_, r) => [(r + 1) * 12, (r + 1) * 12 + 1]),
    );
    ROW_END_STAIRS.forEach((s, r) => {
      expect(s.x, `${s.lower}`).toBe(squareCentre(s.lower)[0]);
      expect(s.x, 'boustrophedon: right end, then left').toBe(r % 2 === 0 ? 5.5 : -5.5);
    });
  });
  it('AStair_Should_ClimbFromTheLowerBlockTopToTheUpperInStepsOfAtMostSixHundredths', () => {
    for (const s of ROW_END_STAIRS) {
      expect(s.yLow).toBe(blockTopY(s.lower));
      expect(s.yHigh).toBe(blockTopY(s.upper));
      expect(s.steps).toBeGreaterThanOrEqual(2);
      expect((s.yHigh - s.yLow) / s.steps, `${s.lower}`).toBeLessThanOrEqual(0.06);
    }
  });
  it('TheGround_(OnAStairTread)_Should_BeTheTreadHeight', () => {
    for (const s of ROW_END_STAIRS) {
      const depth = (s.zBottom - s.zTop) / s.steps;
      const rise = (s.yHigh - s.yLow) / s.steps;
      for (let k = 1; k <= s.steps; k++) {
        const z = s.zBottom - (k - 0.6) * depth; // past the riser blend, on the tread
        expect(groundHeightAt(s.x, z), `${s.lower} tread ${k}`).toBeCloseTo(s.yLow + k * rise, 6);
        expect(groundHeightAt(s.x + STAIR_HALF_WIDTH * 0.9, z)).toBeCloseTo(s.yLow + k * rise, 6);
      }
    }
  });
  it('AWalk_(EverySquareToTheNext)_Should_KeepTheFeetOnTheGroundWithoutAJumpAndClimbTheStairsSteadily', () => {
    // centre to centre, as pathOf walks it; 1 cm samples: a riser is crossed in a short step-up of at most one tread
    for (let square = 1; square < 144; square++) {
      const [ax, , az] = toThree(fieldCentre(square));
      const [bx, , bz] = toThree(fieldCentre(square + 1));
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.01);
      const stair = ROW_END_STAIRS.some((s) => s.lower === square);
      let last = groundHeightAt(ax, az);
      for (let i = 1; i <= n; i++) {
        const y = groundHeightAt(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
        expect(Math.abs(y - last), `${square} -> ${square + 1} at ${i}`).toBeLessThanOrEqual(0.06); // one tread
        if (stair) expect(y, `${square} -> ${square + 1} climbs`).toBeGreaterThanOrEqual(last - 1e-9);
        last = y;
      }
      expect(last).toBeCloseTo(blockTopY(square + 1), 6);
    }
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
    // 35 is a mithila square (0.22) on row 3 and 38 the ayodhya square (0.26) one row behind it, a terrace higher
    // (T45.1; the T44 pair 36 / 37 is a row turn now and climbs a stair, see above)
    const [x38, z38] = squareCentre(38);
    const [x35, z35] = squareCentre(35);
    expect(x38).toBeCloseTo(x35);
    expect(z38).toBeCloseTo(z35 - 1);
    expect(groundHeightAt(x38, z38)).toBeCloseTo(terraceY(3) + 0.26);
    expect(groundHeightAt(x35, z35)).toBeCloseTo(terraceY(2) + 0.22);
    const edge = groundHeightAt(x38, z38 + 0.5);
    expect(edge).toBeGreaterThan(terraceY(2) + 0.22);
    expect(edge).toBeLessThan(terraceY(3) + 0.26);
  });
  it('OnTheFrontRimStrip_Should_BeFieldLevel', () => expect(groundHeightAt(0, 6.15)).toBe(0));
  it('OnTheSideAndBackRimStrips_Should_BeTheirRowsTerrace', () => {
    expect(groundHeightAt(6.15, 5.5)).toBe(0);
    expect(groundHeightAt(-6.15, 0.5)).toBe(terraceY(5));
    expect(groundHeightAt(6.15, -5.5)).toBe(terraceY(11));
    expect(groundHeightAt(0, -6.15)).toBe(terraceY(11));
  });
  it('BeyondTheSlab_Should_BeThePlinthTop', () => expect(groundHeightAt(7.5, 5.8)).toBe(PLINTH_TOP_Y));
});

describe('mount points for the die and tray (spec 7.2)', () => {
  it('TheTrayAnchor_Should_SitOnTheOakLedgeAtThePlinthTop', () => {
    expect(TRAY_ANCHOR[0]).toBeGreaterThan(LEDGE.x0);
    expect(TRAY_ANCHOR[0]).toBeLessThan(LEDGE.x1);
    expect(TRAY_ANCHOR[2]).toBeGreaterThan(LEDGE.z0);
    expect(TRAY_ANCHOR[2]).toBeLessThan(LEDGE.z1);
    expect(TRAY_ANCHOR[1]).toBe(PLINTH_TOP_Y + TRAY_BASE); // the tray stands on the ledge, its felt above the oak
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
