import type { BridgeGeometry } from './geometry.mjs';

export interface BuiltBridge {
  id: string;
  geo: BridgeGeometry;
  parts: Set<string>;
  e0: number;
  e1: number;
  bays: number;
  /** One entry per arch opening drawn. */
  archInfo: { j: number; aH: number; b: number; tr: number; p: number }[];
  band(item: unknown): number;
  /** Set by renderSegments. */
  segments?: Segment[];
  R: { items: unknown[]; solids: { name: string }[] };
}
export interface Segment {
  name: string;
  band: number;
  row: number;
  svg: string;
  width: number;
  height: number;
  anchor: { x: number; y: number };
  world: [number, number];
  depthKey: number;
  items: number;
  crossed: number[];
}
export function buildBridge(id: string, options?: { ring?: number }): BuiltBridge;
