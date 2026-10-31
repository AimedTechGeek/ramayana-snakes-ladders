import type { BuiltBridge } from './build.mjs';

export const MIN_GAP: number;
export const ORDER_TOLERANCE: number;
export interface Proofs {
  pairs: { bridge: string; snake: string; level: string; gap: number }[];
  wedding: { deck: number; coilTop: number; clearance: number } | null;
  setu: { plan: number; R: number } | null;
  sugriva: { overlap: boolean } | null;
  overlaps: { level: string; a: string; b: string }[];
}
export function proveBridges(built: Record<string, BuiltBridge>): Proofs;
export function segmentOrderProblems(
  bridge: BuiltBridge,
): { front: string; back: string; frontKey: number; backKey: number; area: number }[];
export function auditBridges(built: Record<string, BuiltBridge>): number;
