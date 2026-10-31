// Types for atlas.mjs, so tests and typed callers can import it under strict tsc.
export const DEFAULT_OUT: string;
export const FACTORS: { fine: number; coarse: number };
export function nextPot(n: number): number;
export function shelfPack(
  items: { name: string; w: number; h: number }[],
  maxSize?: number,
  minWidth?: number,
): { width: number; height: number; placements: Record<string, { x: number; y: number }> };
export function frameAnchor(
  anchor: { x: number; y: number },
  factor: number,
  padding: number,
): { x: number; y: number };

export interface AtlasFrameSpec {
  name: string;
  svg?: string;
  file?: string;
  width?: number;
  height?: number;
  factor?: number;
  anchor?: { x: number; y: number };
  meta?: Record<string, unknown>;
}
export interface Rasteriser {
  page: unknown;
  close(): Promise<void>;
}
export interface AtlasOptions {
  outDir?: string;
  maxSize?: number;
  /** Narrowest sheet width tried (default 64); a tie in area keeps the narrower sheet, so force a wide one here. */
  minWidth?: number;
  factor?: number;
  padding?: number;
  rasteriser?: Rasteriser;
}
export interface AtlasResult {
  sheet: string;
  png: string;
  json: string;
  meta: string;
  width: number;
  height: number;
  frames: Record<string, { w: number; h: number; factor: number; anchorX: number; anchorY: number }>;
}
export function openRasteriser(): Promise<Rasteriser>;
export function buildAtlas(
  sheetName: string,
  frames: AtlasFrameSpec[],
  options?: AtlasOptions,
): Promise<AtlasResult>;
export function buildAtlases(
  sheets: { sheet: string; frames: AtlasFrameSpec[]; options?: AtlasOptions }[],
): Promise<AtlasResult[]>;
