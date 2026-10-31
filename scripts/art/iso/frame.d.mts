// Types for frame.mjs, so tests can import the placement table under strict tsc.
export const PITCH: number;
export const OVERLAP: number;
export const FRAME_SHEET: string;
export interface FramePlacement {
  id: string;
  frame: string;
  world: [number, number, number];
  depthAt: [number, number];
  depthBias: number;
}
export function framePlacements(): FramePlacement[];
export function frameFixtures(): FramePlacement[];
