import { describe, expect, it } from 'vitest';
import { clampDpr } from '../src/game/hidpi';

describe('clampDpr', () => {
  it('Device pixel ratio above 2 (Scenario) should render at 2', () => {
    expect(clampDpr(3)).toBe(2);
  });
  it('Device pixel ratio of 1.5 (Scenario) should be kept as is', () => {
    expect(clampDpr(1.5)).toBe(1.5);
  });
  it('Missing or invalid device pixel ratio (Scenario) should render at 1', () => {
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(Number.NaN)).toBe(1);
  });
});
