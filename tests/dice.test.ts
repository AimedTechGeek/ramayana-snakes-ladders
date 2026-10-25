import { describe, expect, it } from 'vitest';
import { createRandomDice, createSeededDice, mulberry32 } from '../src/core/dice';

const FACES = [1, 2, 3, 4, 5, 6];

function rollMany(roll: () => number, count: number): number[] {
  return Array.from({ length: count }, roll);
}

describe('dice', () => {
  it('SeededDice_SameSeed_Should_ProduceSameSequence', () => {
    const a = rollMany(createSeededDice(42).roll, 100);
    const b = rollMany(createSeededDice(42).roll, 100);
    expect(a).toEqual(b);
  });

  it('SeededDice_DifferentSeeds_Should_ProduceDifferentSequences', () => {
    const a = rollMany(createSeededDice(1).roll, 100);
    const b = rollMany(createSeededDice(2).roll, 100);
    expect(a).not.toEqual(b);
  });

  it('SeededDice_ManyRolls_Should_StayWithin1To6', () => {
    const rolls = rollMany(createSeededDice(7).roll, 10_000);
    for (const value of rolls) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it('SeededDice_60kRolls_Should_BeRoughlyUniform', () => {
    const counts = new Map<number, number>(FACES.map((face) => [face, 0]));
    for (const value of rollMany(createSeededDice(2026).roll, 60_000)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const face of FACES) {
      expect(counts.get(face)).toBeGreaterThanOrEqual(10_000 - 600);
      expect(counts.get(face)).toBeLessThanOrEqual(10_000 + 600);
    }
  });

  it('Mulberry32_ManyDraws_Should_StayInHalfOpenUnitInterval', () => {
    const next = mulberry32(99);
    for (let i = 0; i < 10_000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('RandomDice_10kRolls_Should_HitEveryFace', () => {
    const seen = new Set(rollMany(createRandomDice().roll, 10_000));
    expect([...seen].sort()).toEqual(FACES);
  });

  it('RandomDice_ManyRolls_Should_StayWithin1To6', () => {
    for (const value of rollMany(createRandomDice().roll, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});
