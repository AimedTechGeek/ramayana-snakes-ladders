// Pure camera rules of the diorama (T44 spec 9): the clamps, the Fit pose and the Focus pose. No React, no controls
// instance; `Camera.tsx` feeds these numbers to drei's CameraControls, and a unit test asserts them.

import { Box3, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { HERO_SCALE } from './figureScale';
import { BLOCK_HALF, LEDGE, PLINTH_BOTTOM_Y, PLINTH_HALF, TRAY_ANCHOR, blockTopY, squareCentre } from './boardLayout';
import type { CameraPose } from './DioramaView';

const DEG = Math.PI / 180;

/** Polar angle from the zenith: 17 deg (almost top-down) to 78 deg (never below the slab's soil band). */
export const MIN_POLAR = 0.3;
export const MAX_POLAR = 1.36;
/** T45.2: heroes are about half size, so the camera may come in to half the old closest distance (was 6). */
export const MIN_DISTANCE = 3;
export const MAX_DISTANCE = 28;
export const MAX_DISTANCE_PHONE = 30;
export const SMOOTH_TIME = 0.28;
export const DRAGGING_SMOOTH_TIME = 0.1;
export const DOLLY_SPEED = 0.8;
export const TRUCK_SPEED = 1.6;
export const BOUNDARY_FRICTION = 0.1;
export const FOV_DESKTOP = 35;
export const FOV_PHONE = 38;
/** A canvas this wide (CSS px) or narrower uses the phone limits. */
export const PHONE_MAX_WIDTH = 900;

/** The camera target may wander inside this box (spec 9.1). */
export const PAN_BOX = new Box3(new Vector3(-5, -0.5, -5), new Vector3(5, 2.5, 5));

/** T45.1: aimed 0.8 u up, about the middle of the terraces' climb (T44: 0.2 on the flat board). */
export const FIT_TARGET: readonly [number, number, number] = [0.3, 0.8, 1.3];
export const FIT_POLAR = 52 * DEG;
export const FIT_AZIMUTH = 22 * DEG;
export const FOCUS_DISTANCE = 4.5;
export const FOCUS_POLAR = 55 * DEG;
/** Focus looks at the hero's middle: 0.5 u up a 1.43 u hero at full size. */
export const FOCUS_LIFT = 0.5 * HERO_SCALE;

/** The box Fit frames: the plinth with its tray ledge, up to the top terrace's block tops (T45.1; T44: 0.3). */
export const FIT_BOX = new Box3(
  new Vector3(-PLINTH_HALF, PLINTH_BOTTOM_Y, -PLINTH_HALF),
  new Vector3(LEDGE.x1, blockTopY(144), PLINTH_HALF),
);
/** Screen margins of the Fit pose, as a share of the half-viewport (NDC units). */
const FIT_MARGIN = { top: 0.07, bottom: 0.03, side: 0.03 };

/** A HUD element's box on the canvas, CSS px from the canvas's top-left corner. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** Fit keeps this many CSS px between a HUD box and the board points it must not cover. */
const HUD_PAD = 6;
/** A standing hero's height on the board: the authored 1.43 u times `HERO_SCALE`. */
export const HERO_HEIGHT = 1.43 * HERO_SCALE;

/**
 * Points Fit keeps out from under the HUD (T44.14): the top corners of every edge square (the inner squares lie inside
 * them on screen), the gate south of square 1, the four waiting heroes on the front rim (feet and heads), and the
 * die tray's rim (it is tapped to roll).
 */
export const KEEP_CLEAR: readonly Vector3[] = (() => {
  const points: Vector3[] = [];
  for (let square = 1; square <= 144; square++) {
    const row = Math.floor((square - 1) / 12);
    const column = (square - 1) % 12;
    if (row !== 0 && row !== 11 && column !== 0 && column !== 11) continue;
    const [x, z] = squareCentre(square);
    const y = blockTopY(square);
    for (const dx of [-BLOCK_HALF, BLOCK_HALF])
      for (const dz of [-BLOCK_HALF, BLOCK_HALF]) points.push(new Vector3(x + dx, y, z + dz));
  }
  const [gx, gz] = squareCentre(1);
  const rim = blockTopY(1);
  points.push(new Vector3(gx, rim, gz + 0.58), new Vector3(gx, rim + 1, gz + 0.58));
  for (let seat = 0; seat < 4; seat++) {
    const x = -3 + seat * 0.5; // coords.waitingSpot
    points.push(new Vector3(x, rim, 6.15), new Vector3(x, rim + HERO_HEIGHT, 6.15));
  }
  const [tx, ty, tz] = TRAY_ANCHOR;
  for (const dx of [-0.6, 0.6]) for (const dz of [-0.8, 0.8]) points.push(new Vector3(tx + dx, ty + 0.06, tz + dz));
  return points;
})();

export function isPhoneWidth(cssWidth: number): boolean {
  return cssWidth <= PHONE_MAX_WIDTH;
}

export function fovFor(cssWidth: number): number {
  return isPhoneWidth(cssWidth) ? FOV_PHONE : FOV_DESKTOP;
}

export function clampPolar(polar: number): number {
  return Math.min(MAX_POLAR, Math.max(MIN_POLAR, polar));
}

export function clampDistance(distance: number, cssWidth: number): number {
  const max = isPhoneWidth(cssWidth) ? MAX_DISTANCE_PHONE : MAX_DISTANCE;
  return Math.min(max, Math.max(MIN_DISTANCE, distance));
}

export function clampTarget(target: Vector3): Vector3 {
  return PAN_BOX.clampPoint(target, new Vector3());
}

/** Camera position for a target, azimuth (0 = looking from +z), polar (from the zenith) and distance. */
export function positionFor(target: Vector3, azimuth: number, polar: number, distance: number): Vector3 {
  const sin = Math.sin(polar);
  return new Vector3(
    target.x + distance * sin * Math.sin(azimuth),
    target.y + distance * Math.cos(polar),
    target.z + distance * sin * Math.cos(azimuth),
  );
}

function fits(
  distance: number,
  aspect: number,
  fov: number,
  azimuth: number,
  target: Vector3,
  hud: readonly ScreenRect[] = [],
  canvas: { width: number; height: number } = { width: aspect, height: 1 },
): boolean {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 200);
  camera.position.copy(positionFor(target, azimuth, FIT_POLAR, distance));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const { min, max } = FIT_BOX;
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) {
        const ndc = new Vector3(x, y, z).applyMatrix4(viewProjection);
        if (Math.abs(ndc.x) > 1 - FIT_MARGIN.side) return false;
        if (ndc.y > 1 - FIT_MARGIN.top || ndc.y < -1 + FIT_MARGIN.bottom) return false;
      }
  if (hud.length === 0) return true;
  const point = new Vector3();
  for (const p of KEEP_CLEAR) {
    point.copy(p).applyMatrix4(viewProjection);
    const px = ((point.x + 1) / 2) * canvas.width;
    const py = ((1 - point.y) / 2) * canvas.height;
    for (const r of hud) {
      const inside = px > r.left - HUD_PAD && px < r.right + HUD_PAD && py > r.top - HUD_PAD && py < r.bottom + HUD_PAD;
      if (inside) return false;
    }
  }
  return true;
}

/** Smallest distance at which the whole FIT_BOX is inside the margins at this aspect and fov (bisection). */
export function fitDistance(
  aspect: number,
  fov: number,
  azimuth = FIT_AZIMUTH,
  target: Vector3 = new Vector3(...FIT_TARGET),
  hud: readonly ScreenRect[] = [],
  canvas?: { width: number; height: number },
): number {
  let near = MIN_DISTANCE;
  let far = 80;
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    if (fits(mid, aspect, fov, azimuth, target, hud, canvas)) far = mid;
    else near = mid;
  }
  return far;
}

/**
 * The target near FIT_TARGET that lets the box fit from closest in: the box is lopsided (tray ledge at front right) and
 * the HUD takes parts of the screen's edges, so a small ground-plane search places it. Deterministic.
 */
export function bestFitTarget(
  aspect: number,
  fov: number,
  azimuth: number,
  hud: readonly ScreenRect[] = [],
  canvas?: { width: number; height: number },
): Vector3 {
  let best = new Vector3(...FIT_TARGET);
  let bestDistance = fitDistance(aspect, fov, azimuth, best, hud, canvas);
  for (let x = -2; x <= 2; x += 0.5)
    for (let z = -0.5; z <= 3.5; z += 0.5) {
      const candidate = new Vector3(x, FIT_TARGET[1], z);
      const distance = fitDistance(aspect, fov, azimuth, candidate, hud, canvas);
      if (distance < bestDistance - 1e-6) {
        best = candidate;
        bestDistance = distance;
      }
    }
  return best;
}

/**
 * Fit: the pose (position, target) at a given azimuth for this canvas. `hud` are the boxes of the HUD over the canvas
 * (seat cards, banner, toolbar, Roll pill): no edge square, the gate or a waiting hero sits under one (T44.14; this
 * replaces T44.8's fixed 52 px slide, which left squares 1-3 and the gate under four seat cards).
 */
export function fitPose(
  cssWidth: number,
  cssHeight: number,
  azimuth = FIT_AZIMUTH,
  hud: readonly ScreenRect[] = [],
): { position: Vector3; target: Vector3; distance: number } {
  const fov = fovFor(cssWidth);
  const aspect = cssWidth / Math.max(1, cssHeight);
  const canvas = { width: cssWidth, height: cssHeight };
  const target = bestFitTarget(aspect, fov, azimuth, hud, canvas);
  const distance = clampDistance(fitDistance(aspect, fov, azimuth, target, hud, canvas), cssWidth);
  return { position: positionFor(target, azimuth, FIT_POLAR, distance), target, distance };
}

/** A board point on the canvas, CSS px, for a camera pose (what Fit checks against the HUD boxes). */
export function projectToCanvas(
  point: Vector3,
  pose: { position: Vector3; target: Vector3 },
  cssWidth: number,
  cssHeight: number,
): [number, number] {
  const camera = new PerspectiveCamera(fovFor(cssWidth), cssWidth / Math.max(1, cssHeight), 0.1, 200);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  camera.updateMatrixWorld();
  const ndc = point.clone().project(camera);
  return [((ndc.x + 1) / 2) * cssWidth, ((1 - ndc.y) / 2) * cssHeight];
}

/**
 * Bite close-ups (T45.4): the only camera moves the game makes by itself. Closer than Focus and a touch lower, so the
 * grown coil and the hero fill the frame; the azimuth is the player's, so the glide is a dolly, never a spin. The
 * distance is clamped to the rig's minimum at run time (MIN_DISTANCE follows T45.2).
 */
export const BITE_DISTANCE = 3.5;
export const BITE_POLAR = 58 * DEG;
export const BITE_LIFT = 0.35;

/** The close-up pose on a block-top point (the snake's head block, then the tail square), azimuth kept. */
export function bitePose(point: readonly [number, number, number], azimuth: number): CameraPose {
  const target = clampTarget(new Vector3(point[0], point[1] + BITE_LIFT, point[2]));
  return { azimuth, polar: BITE_POLAR, distance: BITE_DISTANCE, target: [target.x, target.y, target.z] };
}

/** An eased camera pose between two, u in 0..1 (the rig's glide; angles are interpolated as the rig reports them). */
export function lerpPose(from: Required<CameraPose>, to: Required<CameraPose>, u: number): Required<CameraPose> {
  const mix = (a: number, b: number): number => a + (b - a) * u;
  return {
    azimuth: mix(from.azimuth, to.azimuth),
    polar: mix(from.polar, to.polar),
    distance: mix(from.distance, to.distance),
    target: [mix(from.target[0], to.target[0]), mix(from.target[1], to.target[1]), mix(from.target[2], to.target[2])],
  };
}

export function easeInOut(u: number): number {
  return 0.5 - Math.cos(Math.max(0, Math.min(1, u)) * Math.PI) / 2;
}

/** Focus: close on a token's feet, azimuth kept, polar 55 deg, distance 4.5 u. Only ever called from the Focus button. */
export function focusPose(
  feet: readonly [number, number, number],
  azimuth: number,
): { position: Vector3; target: Vector3 } {
  const target = clampTarget(new Vector3(feet[0], feet[1] + FOCUS_LIFT, feet[2]));
  return { position: positionFor(target, azimuth, FOCUS_POLAR, FOCUS_DISTANCE), target };
}
