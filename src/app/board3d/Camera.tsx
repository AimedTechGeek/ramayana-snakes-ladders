// The diorama camera (T44 spec 9): drei CameraControls with the polar/distance/pan clamps of cameraConfig.ts.
// The player owns it: orbit, dolly to the cursor, pan, Fit and Focus buttons, a few keys. It never follows a token.

import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import {
  BOUNDARY_FRICTION,
  DOLLY_SPEED,
  DRAGGING_SMOOTH_TIME,
  FIT_AZIMUTH,
  MAX_DISTANCE,
  MAX_DISTANCE_PHONE,
  MAX_POLAR,
  MIN_DISTANCE,
  MIN_POLAR,
  PAN_BOX,
  SMOOTH_TIME,
  TRUCK_SPEED,
  clampDistance,
  fitPose,
  focusPose,
  fovFor,
  isPhoneWidth,
  type ScreenRect,
} from './cameraConfig';
import type { DioramaView } from './DioramaView';

const ORBIT_STEP = (5 * Math.PI) / 180;
const DOLLY_STEP = 1.2;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The HUD boxes Fit keeps the board out from under (elements marked `data-fit-reserve`), in canvas CSS px. */
function hudRects(canvas: HTMLElement): ScreenRect[] {
  const origin = canvas.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>('[data-fit-reserve]')].flatMap((element) => {
    const r = element.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return [];
    return [{ left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top }];
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function CameraRig({ view }: { view: DioramaView }) {
  const controls = useRef<CameraControls>(null);
  /** The player has orbited, panned or zoomed since the last fit: a resize then keeps their view. */
  const moved = useRef(false);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const canvas = useThree((state) => state.gl.domElement);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const reduced = useMemo(prefersReducedMotion, []);

  const fitTo = (rig: CameraControls, azimuth: number, animate: boolean): void => {
    const { position, target } = fitPose(width, height, azimuth, hudRects(canvas));
    void rig.setFocalOffset(0, 0, 0, animate && !reduced);
    void rig.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, animate && !reduced);
  };
  const latest = useRef({ fitTo });
  latest.current = { fitTo };

  useEffect(() => {
    camera.fov = fovFor(width);
    camera.updateProjectionMatrix();
  }, [camera, width]);

  useEffect(() => {
    const rig = controls.current;
    if (!rig) return;
    rig.setBoundary(PAN_BOX);
    const onControl = (): void => {
      moved.current = true;
    };
    rig.addEventListener('controlstart', onControl);
    view.camera = {
      fit: () => {
        moved.current = false;
        latest.current.fitTo(rig, rig.azimuthAngle, true);
      },
      focus: (player) => {
        const at = view.tokenPosition(player);
        if (!at) return;
        moved.current = true;
        const { position, target } = focusPose(at, rig.azimuthAngle);
        void rig.setFocalOffset(0, 0, 0, !reduced);
        void rig.setLookAt(position.x, position.y, position.z, target.x, target.y, target.z, !reduced);
      },
      set: ({ azimuth, polar, distance, target }) => {
        moved.current = true;
        void rig.setFocalOffset(0, 0, 0, false);
        if (target) void rig.setTarget(target[0], target[1], target[2], false);
        void rig.rotateTo(azimuth, polar, false);
        void rig.dollyTo(distance, false);
        rig.update(0);
      },
      get: () => {
        const target = rig.getTarget(new Vector3());
        return {
          azimuth: rig.azimuthAngle,
          polar: rig.polarAngle,
          distance: rig.distance,
          target: [target.x, target.y, target.z],
        };
      },
    };
    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      let handled = true;
      if (event.key === 'ArrowLeft') void rig.rotate(-ORBIT_STEP, 0, !reduced);
      else if (event.key === 'ArrowRight') void rig.rotate(ORBIT_STEP, 0, !reduced);
      else if (event.key === 'ArrowUp') void rig.rotate(0, -ORBIT_STEP, !reduced);
      else if (event.key === 'ArrowDown') void rig.rotate(0, ORBIT_STEP, !reduced);
      else if (event.key === '+' || event.key === '=')
        void rig.dollyTo(clampDistance(rig.distance / DOLLY_STEP, width), !reduced);
      else if (event.key === '-' || event.key === '_')
        void rig.dollyTo(clampDistance(rig.distance * DOLLY_STEP, width), !reduced);
      else handled = false;
      if (handled) moved.current = true;
    };
    window.addEventListener('keydown', onKey);
    if (import.meta.env.DEV) (window as unknown as { __camera?: CameraControls }).__camera = rig;
    return () => {
      window.removeEventListener('keydown', onKey);
      rig.removeEventListener('controlstart', onControl);
      view.camera = null;
    };
  }, [view, reduced, width]);

  // The canvas size is part of the fit: until the player moves the camera, a resize or rotation re-fits the board.
  useEffect(() => {
    const rig = controls.current;
    if (rig && !moved.current) latest.current.fitTo(rig, FIT_AZIMUTH, false);
  }, [width, height]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      minDistance={MIN_DISTANCE}
      maxDistance={isPhoneWidth(width) ? MAX_DISTANCE_PHONE : MAX_DISTANCE}
      smoothTime={reduced ? 0 : SMOOTH_TIME}
      draggingSmoothTime={reduced ? 0 : DRAGGING_SMOOTH_TIME}
      dollyToCursor
      dollySpeed={DOLLY_SPEED}
      truckSpeed={TRUCK_SPEED}
      boundaryFriction={BOUNDARY_FRICTION}
    />
  );
}
