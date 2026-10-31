// Placeholder shapes of the bridges (ladders) and snakes, in three units. The crossing token follows the same
// bridge curve the renderer draws.

import { CatmullRomCurve3, QuadraticBezierCurve3, Vector3, type Curve } from 'three';
import type { Jump } from '../../core/types';
import { fieldCentre } from '../../game/iso/boardIso';
import { toThree } from './coords';

function centre(square: number): Vector3 {
  return new Vector3(...toThree(fieldCentre(square)));
}

/** A stone arch from the foot square to the top square; longer bridges arch higher. */
export function bridgeCurve(jump: Jump): Curve<Vector3> {
  const from = centre(jump.from);
  const to = centre(jump.to);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += 0.6 + from.distanceTo(to) * 0.18;
  return new QuadraticBezierCurve3(from, mid, to);
}

/** A body that winds from the head square down to the tail square, lying just above the blocks. */
export function snakeCurve(jump: Jump): Curve<Vector3> {
  const head = centre(jump.from);
  const tail = centre(jump.to);
  const along = tail.clone().sub(head);
  const side = new Vector3(-along.z, 0, along.x).normalize();
  const points: Vector3[] = [];
  const bends = 5;
  for (let i = 0; i <= bends; i++) {
    const u = i / bends;
    const sway = i === 0 || i === bends ? 0 : (i % 2 === 0 ? 1 : -1) * 0.45;
    const point = head.clone().lerp(tail, u).addScaledVector(side, sway);
    point.y = 0.12 + (i === 0 ? 0.25 : 0);
    points.push(point);
  }
  return new CatmullRomCurve3(points);
}
