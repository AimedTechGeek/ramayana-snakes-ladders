// Types for geometry.mjs, so tests can import it under strict tsc.
import type { StoryJump } from '../../../../src/core/boards';

export const RIBBON: number;
export const TILE_HALF: number;
export const DECK_THICK: number;
export const CORNICE: number;
export const FOOT_HALF: number;
export const TOP_BACK: number;
export const TOP_FRONT: number;
export const ABUTMENT_H: number;
export const BOW: Record<string, number>;
export function bandOfY(y: number): number;
export function polygonsOverlap(a: number[][], b: number[][]): boolean;
export function tileRect(square: number, half?: number): { x0: number; x1: number; y0: number; y1: number };
export function storyJump(id: string): StoryJump;

export interface RoutePoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}
export interface BridgeGeometry {
  id: string;
  jump: StoryJump;
  from: number;
  to: number;
  F: [number, number];
  T: [number, number];
  /** Straight foot-to-top distance L of the spec table (openings and height come from it). */
  straight: number;
  bow: number;
  /** Arc length of the route (L plus the bow). */
  Lp: number;
  h: number;
  openings: number;
  sample(s: number): RoutePoint;
  deckTop(s: number): number;
  exitFoot: number;
  exitTop: number;
  bandCuts: number[];
  crossed: number[];
  deck: [number, number][];
  route: [number, number][];
}
export function bridgeGeometry(id: string): BridgeGeometry;
