import type Phaser from 'phaser';

/** Logical canvas size: every scene lays out in these units whatever the device pixel ratio. */
export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

const MAX_DPR = 2;

/** Device pixel ratio the canvas is rendered at: the device's own, never below 1 and capped at 2. */
export function clampDpr(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio < 1) return 1;
  return Math.min(MAX_DPR, devicePixelRatio);
}

export const DPR = clampDpr(typeof window === 'undefined' ? 1 : window.devicePixelRatio);

/**
 * Makes the scene's main camera show the 1280x720 logical area on the 1280*DPR x 720*DPR canvas.
 * Zoom scales around the camera centre, so the centre is put on the middle of the logical area.
 * Call from each scene's create (or preload for a scene that draws there).
 */
export function applyHiDpi(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(DPR).centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}
