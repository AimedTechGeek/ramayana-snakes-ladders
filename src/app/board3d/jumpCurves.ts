// Shapes of the bridges (ladders) and the placeholder snakes, in three units. The crossing token follows the deck
// the bridge GLB is built from (bridgeGeometry.ts).

import { CatmullRomCurve3, CurvePath, LineCurve3, Vector3, type Curve } from 'three';
import type { StoryJump } from '../../core/boards';
import type { Jump } from '../../core/types';
import { bridgeById } from './bridgeGeometry';
import { fieldCentre } from '../../game/iso/boardIso';
import { toThree } from './coords';

function centre(square: number): Vector3 {
  return new Vector3(...toThree(fieldCentre(square)));
}

/**
 * The path a hero takes over a bridge, by arc length: the foot square's field centre, the deck (the same samples the
 * GLB is built from, so feet stay on the stones), the top square's field centre. The first and last straight
 * pieces are the step-on and step-off leaps; `bridgeLeads` measures them.
 */
export function bridgeCurve(jump: StoryJump): CurvePath<Vector3> {
  const bridge = bridgeById(jump.id);
  const path = new CurvePath<Vector3>();
  if (!bridge) {
    path.add(new LineCurve3(centre(jump.from), centre(jump.to)));
    return path;
  }
  const points = [centre(jump.from), ...bridge.deck.map((p) => new Vector3(p.x, p.y, p.z)), centre(jump.to)];
  for (let i = 1; i < points.length; i++) path.add(new LineCurve3(points[i - 1]!, points[i]!));
  return path;
}

/** Lengths of the step-on and step-off pieces (field centre to the abutment top, and back), and of the deck between. */
export function bridgeLeads(path: CurvePath<Vector3>): { leadIn: number; leadOut: number; deck: number } {
  const first = path.curves[0];
  const last = path.curves[path.curves.length - 1];
  const leadIn = path.curves.length > 1 && first ? first.getLength() : 0;
  const leadOut = path.curves.length > 1 && last ? last.getLength() : 0;
  return { leadIn, leadOut, deck: path.getLength() - leadIn - leadOut };
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
    point.y = head.y + (tail.y - head.y) * u + 0.12 + (i === 0 ? 0.25 : 0);
    points.push(point);
  }
  return new CatmullRomCurve3(points);
}
