// Types for world.mjs, so tests can import it under strict tsc.
import type { WorldOffset } from '../../../src/game/iso/world';

export const CELL: number;
export const SIZE: number;
export const RIM: number;
export const BASE_H: number;
export const FOOT_H: number;
export const FIELD_Z: number;
export const TOP_Z: number;
export const RIM_Z: number;
export const SILL_D: number;
export const FIELD_C_OFFSET: WorldOffset;
export const FIG_H: number;
export const HEADROOM: number;
export const FAN_WORLD: Record<1 | 2 | 3 | 4, readonly WorldOffset[]>;
