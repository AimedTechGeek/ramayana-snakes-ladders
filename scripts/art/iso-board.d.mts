// Types for iso-board.mjs, so tests can import it under strict tsc.
import type { Point3, Projection } from '../../src/game/iso/isoKit';

export const camera: {
  cell: number;
  columns: number;
  rect: { x: number; y: number; width: number; height: number };
};
export function squareWorld(square: number): Point3;
export function boardProjection(): Projection;
export function toScreen(point: Point3): { x: number; y: number };
export function squareScreen(square: number): { x: number; y: number };
export function worldOffsetScreen(square: number, dx: number, dy: number): { x: number; y: number };
export function depthKey(point: Point3): number;
