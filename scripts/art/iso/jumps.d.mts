// Types for jumps.mjs, so tests can import it under strict tsc.
import type { Level } from '../../../src/core/types';
import type { Bezier, JumpPath, Vec2, Vec3 } from '../../../src/game/iso/jumps';

export const STEP: number;
export const HARD_CAP: number;
export const HUMP_MARGIN: number;
export const SNAKE_RADIUS: Record<string, number>;
export const LADDER_RELIEF: Record<string, number>;
export function fieldCentre(square: number): Vec2;
export function snakeBezier(head: Vec2, tail: Vec2): Bezier;
export function bezierPoint(bezier: Bezier, u: number): Vec2;
export function snakeRadiusAt(radius: number, t: number): number;
export function jumpPaths(level: Level): JumpPath[];
export function jumpPath(level: Level, id: string): JumpPath | undefined;
export function glidePoint(path: JumpPath, u: number): Vec3;
