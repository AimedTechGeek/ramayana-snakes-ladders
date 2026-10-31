// Types for blocks.mjs, so tests can import it under strict tsc.
import type { AtlasFrameSpec } from './atlas.mjs';

export const seedOf: (square: number) => number;
export const patternOf: (square: number) => 'a' | 'b';
export const propCountOf: (square: number) => 1 | 2;
export const GANGA_SQUARES: number[];
export function regionOf(
  square: number,
): 'mithila' | 'ayodhya' | 'dandaka' | 'ganga' | 'kishkindha' | 'sea' | 'lanka';
export function frameNameOf(square: number): string;
export const REGIONS: Record<string, { a: string; b?: string; line: string; ink: 'dark' | 'bone' }>;
export function tileSvg(region: string, pattern?: string): string;
export function fogSvg(region: string): string;
export function numeralSvg(digit: string, ink: 'dark' | 'bone'): string;
export function mistSvg(variant: number): string;
export function blockFrames(): AtlasFrameSpec[];
export function sharedFrames(): AtlasFrameSpec[];
export function numeralLayout(): {
  sill: { x: number; y: number };
  advance: { x: number; y: number };
  advanceUnits: number;
};
export function writeSvgs(dir: string, frames: AtlasFrameSpec[]): void;
