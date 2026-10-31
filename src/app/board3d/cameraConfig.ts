// Pure camera rules of the diorama (T44 spec 9): the clamps, the Fit pose and the Focus pose. No React, no controls
// instance; `Camera.tsx` feeds these numbers to drei's CameraControls, and a unit test asserts them.

import { Box3, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { LEDGE, PLINTH_BOTTOM_Y, PLINTH_HALF } from './boardLayout';

const DEG = Math.PI / 180;

/** Polar angle from the zenith: 17 deg (almost top-down) to 78 deg (never below the slab's soil band). */
export const MIN_POLAR = 0.3;
export const MAX_POLAR = 1.36;
export const MIN_DISTANCE = 6;
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

export const FIT_TARGET: readonly [number, number, number] = [0.3, 0.2, 1.3];
export const FIT_POLAR = 52 * DEG;
export const FIT_AZIMUTH = 22 * DEG;
export const FOCUS_DISTANCE = 7;
export const FOCUS_POLAR = 55 * DEG;
export const FOCUS_LIFT = 0.5;

/** The box Fit frames: the plinth with its tray ledge and the brass posts. */
export const FIT_BOX = new Box3(
  new Vector3(-PLINTH_HALF, PLINTH_BOTTOM_Y, -PLINTH_HALF),
  new Vector3(LEDGE.x1, 0.3, PLINTH_HALF),
);
/** Screen margins of the Fit pose, as a share of the half-viewport (NDC units). */
const FIT_MARGIN = { top: 0.07, bottom: 0.03, side: 0.03 };

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

function fits(distance: number, aspect: number, fov: number, azimuth: number, target: Vector3): boolean {
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
  return true;
}

/** Smallest distance at which the whole FIT_BOX is inside the margins at this aspect and fov (bisection). */
export function fitDistance(
  aspect: number,
  fov: number,
  azimuth = FIT_AZIMUTH,
  target: Vector3 = new Vector3(...FIT_TARGET),
): number {
  let near = MIN_DISTANCE;
  let far = 80;
  for (let i = 0; i < 28; i++) {
    const mid = (near + far) / 2;
    if (fits(mid, aspect, fov, azimuth, target)) far = mid;
    else near = mid;
  }
  return far;
}

/**
 * The target near FIT_TARGET that lets the box fit from closest in: the box is lopsided (tray ledge at front right), so a
 * small ground-plane search centres it on screen. Deterministic, a few hundred projections.
 */
export function bestFitTarget(aspect: number, fov: number, azimuth: number): Vector3 {
  let best = new Vector3(...FIT_TARGET);
  let bestDistance = fitDistance(aspect, fov, azimuth, best);
  for (let x = -1; x <= 2; x += 0.5)
    for (let z = -0.5; z <= 3.5; z += 0.5) {
      const candidate = new Vector3(x, FIT_TARGET[1], z);
      const distance = fitDistance(aspect, fov, azimuth, candidate);
      if (distance < bestDistance - 1e-6) {
        best = candidate;
        bestDistance = distance;
      }
    }
  return best;
}

/** Fit: the pose (position, target) at a given azimuth for this canvas. */
export function fitPose(
  cssWidth: number,
  cssHeight: number,
  azimuth = FIT_AZIMUTH,
): { position: Vector3; target: Vector3; distance: number } {
  const fov = fovFor(cssWidth);
  const aspect = cssWidth / Math.max(1, cssHeight);
  const target = bestFitTarget(aspect, fov, azimuth);
  const distance = clampDistance(fitDistance(aspect, fov, azimuth, target), cssWidth);
  return { position: positionFor(target, azimuth, FIT_POLAR, distance), target, distance };
}

/** Focus: close on a token's feet, azimuth kept, polar 55 deg, distance 7 u. Only ever called from the Focus button. */
export function focusPose(
  feet: readonly [number, number, number],
  azimuth: number,
): { position: Vector3; target: Vector3 } {
  const target = clampTarget(new Vector3(feet[0], feet[1] + FOCUS_LIFT, feet[2]));
  return { position: positionFor(target, azimuth, FOCUS_POLAR, FOCUS_DISTANCE), target };
}
