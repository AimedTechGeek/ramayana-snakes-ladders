// Pure maths for the zoomable board camera (T42.A). No Phaser: units are logical px (1280x720 space).
// A view is the board camera's state: `zoom` is the user zoom (1 = the whole board fits), (cx, cy) the world point
// at the middle of the viewport. The Phaser camera runs at DPR * zoom.

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface View {
  zoom: number;
  cx: number;
  cy: number;
}

/** The board camera's screen area (logical px) and the world rectangle the camera may show. */
export const BOARD_VIEWPORT: Size = { width: 784, height: 720 };
export const BOARD_WORLD: Size = { width: 784, height: 720 };

export const MIN_ZOOM = 1;
/** Textures are rastered for this zoom (camera.json zoom.max): never zoom past it. */
export const MAX_ZOOM = 2.5;
/** User zoom the camera eases to while it follows the current token. */
export const FOLLOW_ZOOM = 2;
/**
 * Automatic follow (turn start, token moves, snake pans) is off by owner request: the board camera moves only for the
 * player's own wheel, drag, pinch, + / − and Fit. Set to true to bring the follow camera back.
 */
export const AUTO_FOLLOW = false;
/** Time a follow pan or fit takes to settle (about 95 % of the way). */
export const EASE_MS = 350;
/** A pointer must travel this far (logical px) before a press is a drag instead of a tap. */
export const DRAG_THRESHOLD = 8;
/** Zoom factor of one + or - press. */
export const BUTTON_ZOOM_STEP = 1.4;
/** While following, the token is kept inside the viewport shrunk by this fraction of each side. */
export const KEEP_IN_VIEW_INSET = 0.2;

/** The whole board in view: the camera look before T42. */
export function fitView(world: Size = BOARD_WORLD): View {
  return { zoom: MIN_ZOOM, cx: world.width / 2, cy: world.height / 2 };
}

export function clampZoom(zoom: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  if (!Number.isFinite(zoom)) return min;
  return Math.min(max, Math.max(min, zoom));
}

/** Keeps the centre so the viewport stays inside the world (pan bounds). */
export function clampView(view: View, viewport: Size = BOARD_VIEWPORT, world: Size = BOARD_WORLD): View {
  const zoom = clampZoom(view.zoom);
  const halfW = viewport.width / zoom / 2;
  const halfH = viewport.height / zoom / 2;
  const clampAxis = (centre: number, half: number, extent: number) =>
    half * 2 >= extent ? extent / 2 : Math.min(extent - half, Math.max(half, centre));
  return { zoom, cx: clampAxis(view.cx, halfW, world.width), cy: clampAxis(view.cy, halfH, world.height) };
}

/** World point shown at a viewport point (logical px from the viewport's top-left). */
export function viewToWorld(view: View, screen: Point, viewport: Size = BOARD_VIEWPORT): Point {
  return {
    x: view.cx + (screen.x - viewport.width / 2) / view.zoom,
    y: view.cy + (screen.y - viewport.height / 2) / view.zoom,
  };
}

/** Viewport point (logical px from the viewport's top-left) where a world point is drawn. */
export function worldToView(view: View, world: Point, viewport: Size = BOARD_VIEWPORT): Point {
  return {
    x: (world.x - view.cx) * view.zoom + viewport.width / 2,
    y: (world.y - view.cy) * view.zoom + viewport.height / 2,
  };
}

/** The view at `zoom` that draws `world` at `screen`: the one rule behind wheel zoom, drag pan and pinch. */
export function viewWithAnchor(
  zoom: number,
  world: Point,
  screen: Point,
  viewport: Size = BOARD_VIEWPORT,
  worldSize: Size = BOARD_WORLD,
): View {
  const z = clampZoom(zoom);
  return clampView(
    {
      zoom: z,
      cx: world.x - (screen.x - viewport.width / 2) / z,
      cy: world.y - (screen.y - viewport.height / 2) / z,
    },
    viewport,
    worldSize,
  );
}

/** Zooms to `zoom`, keeping the world point under `screen` (the cursor) where it is. */
export function zoomToward(view: View, zoom: number, screen: Point, viewport: Size = BOARD_VIEWPORT): View {
  return viewWithAnchor(zoom, viewToWorld(view, screen, viewport), screen, viewport);
}

/** Drag pan: the world point grabbed at `grabScreen` follows the pointer to `nowScreen`. */
export function panBy(
  start: View,
  grabScreen: Point,
  nowScreen: Point,
  viewport: Size = BOARD_VIEWPORT,
): View {
  return viewWithAnchor(start.zoom, viewToWorld(start, grabScreen, viewport), nowScreen, viewport);
}

/** Pinch: the world point under the first finger midpoint stays under the current midpoint, zoom scales with the finger distance. */
export function pinchView(
  start: View,
  startMid: Point,
  startDistance: number,
  nowMid: Point,
  nowDistance: number,
  viewport: Size = BOARD_VIEWPORT,
): View {
  const ratio = startDistance > 0 ? nowDistance / startDistance : 1;
  return viewWithAnchor(start.zoom * ratio, viewToWorld(start, startMid, viewport), nowMid, viewport);
}

/** The view that centres a world point at `zoom` (pan bounds applied). */
export function followTarget(world: Point, zoom: number = FOLLOW_ZOOM): View {
  return clampView({ zoom, cx: world.x, cy: world.y });
}

/**
 * Where an automatic follow eases the camera: the token's point, or the whole board when there is none (a seat card).
 * Null while auto follow is off, so the camera does not move by itself.
 */
export function followGoal(world: Point | null, enabled: boolean = AUTO_FOLLOW): View | null {
  if (!enabled) return null;
  return world ? followTarget(world) : fitView();
}

/** True once a pointer has moved far enough from where it went down to count as a drag. */
export function isDrag(down: Point, now: Point, threshold = DRAG_THRESHOLD): boolean {
  return Math.hypot(now.x - down.x, now.y - down.y) > threshold;
}

/** Fraction of the remaining distance to cover this frame so a move settles (95 %) in `durationMs`. 1 means jump. */
export function easeFactor(dtMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return 1 - Math.exp((-3 * Math.max(0, dtMs)) / durationMs);
}

/** One frame of easing from `current` towards `goal`; zoom is eased in log space so in and out feel alike. */
export function easeView(current: View, goal: View, dtMs: number, durationMs: number): View {
  const k = easeFactor(dtMs, durationMs);
  if (k >= 1) return { ...goal };
  const zoom = current.zoom * Math.pow(goal.zoom / current.zoom, k);
  const done =
    Math.abs(goal.zoom - zoom) < 1e-3 && Math.hypot(goal.cx - current.cx, goal.cy - current.cy) < 0.05;
  if (done) return { ...goal };
  return {
    zoom,
    cx: current.cx + (goal.cx - current.cx) * k,
    cy: current.cy + (goal.cy - current.cy) * k,
  };
}

/** Shifts the view just enough that `world` is inside the viewport shrunk by `inset` (so a fast glide never leaves the screen). */
export function keepInView(
  view: View,
  world: Point,
  inset = KEEP_IN_VIEW_INSET,
  viewport: Size = BOARD_VIEWPORT,
): View {
  const marginX = viewport.width * inset;
  const marginY = viewport.height * inset;
  const at = worldToView(view, world, viewport);
  const dx =
    at.x < marginX ? at.x - marginX : at.x > viewport.width - marginX ? at.x - (viewport.width - marginX) : 0;
  const dy =
    at.y < marginY
      ? at.y - marginY
      : at.y > viewport.height - marginY
        ? at.y - (viewport.height - marginY)
        : 0;
  if (dx === 0 && dy === 0) return view;
  return clampView({ zoom: view.zoom, cx: view.cx + dx / view.zoom, cy: view.cy + dy / view.zoom });
}
