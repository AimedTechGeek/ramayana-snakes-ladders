import type { BridgeGeometry } from './geometry.mjs';
import type { BuiltBridge, Segment } from './build.mjs';

export function bandMiddle(geo: BridgeGeometry, band: number): [number, number];
export function segmentAnchor(geo: BridgeGeometry, band: number): { at: [number, number]; depthKey: number };
export function assignBands(built: BuiltBridge): { remaining: number; moved: number };
export function crossedBySegment(built: BuiltBridge): Map<number, number[]>;
export function renderSegments(built: BuiltBridge): Segment[];
