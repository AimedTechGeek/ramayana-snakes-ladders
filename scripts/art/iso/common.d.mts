// Types for common.mjs, so tests can import it under strict tsc.
import type { Projection } from '../../../src/game/iso/isoKit';

export function mixHex(from: string, to: string, amount: number): string;
export const TOKENS: { white: string; hi: string; mid: string };
export const SEAT_COLOURS: Record<string, string>;
export function seatBand(hero: string): { top: string; shades: [string, string, string, string] };
export function snakeInks(): Record<string, { edge: string; head: string }>;
export function ladderInks(): Record<string, { rail: string; rung: string }>;
export function extraCss(): string;
export function exportSvg(options: {
  width: number;
  height: number;
  label: string;
  body: string | string[];
}): string;
export function cropProjection(
  base: Projection,
  worldPoints: [number, number, number][],
  pad?: number,
): { projection: Projection; width: number; height: number };
export function writeSvg(file: string, svg: string): void;
export function writeManifest(file: string, entries: Record<string, unknown>): string;
export const NUMERAL_STROKES: Record<string, number[][][]>;
export const NUMERAL_ADVANCE: number;
export const NUMERAL_WIDTH: number;
export const NUMERAL_BASELINE: number;
export function numeralStrokes(text: string, cx: number, cy: number): number[][][];
export function numeralSvg(text: string, cx: number, cy: number, projection: Projection, z?: number): string;
