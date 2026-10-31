// Where a speech bubble goes: beside the speaking seat card, or above a token's projected screen point.
// Pure geometry (viewport pixels), so it is unit-tested and the integrator only has to feed points.

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  left: number;
  top: number;
}

/** A point in viewport CSS pixels, e.g. a token's head projected by the camera. */
export interface ScreenPoint {
  x: number;
  y: number;
}

export type BubbleTarget =
  { kind: 'point'; point: ScreenPoint } | { kind: 'card'; rect: Rect; side?: 'right' | 'below' };

export interface Placement {
  left: number;
  top: number;
  /** The bubble edge the tail grows from; it points at the speaker. */
  tailSide: 'left' | 'right' | 'top' | 'bottom';
  /** Tail position along that edge, in px from the bubble's left (top / bottom) or top (left / right) edge. */
  tail: number;
}

export const BUBBLE_MARGIN = 8;
export const BUBBLE_GAP = 12;
const TAIL_INSET = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInside(start: number, length: number, limit: number): number {
  return clamp(start, BUBBLE_MARGIN, Math.max(BUBBLE_MARGIN, limit - BUBBLE_MARGIN - length));
}

function tailAlong(pointer: number, start: number, length: number): number {
  return clamp(pointer - start, TAIL_INSET, Math.max(TAIL_INSET, length - TAIL_INSET));
}

/** Above a point (tail down), or below it when there is no room above; kept inside the viewport. */
function placeAbovePoint(point: ScreenPoint, size: Size, viewport: Size): Placement {
  const left = clampInside(point.x - size.width / 2, size.width, viewport.width);
  const above = point.y - BUBBLE_GAP - size.height;
  const fitsAbove = above >= BUBBLE_MARGIN;
  const top = fitsAbove ? above : clampInside(point.y + BUBBLE_GAP, size.height, viewport.height);
  return { left, top, tailSide: fitsAbove ? 'bottom' : 'top', tail: tailAlong(point.x, left, size.width) };
}

/** Below a card (tail up), for the phone's chip grid where the right side is taken by the turn banner. */
function placeBelowCard(rect: Rect, size: Size, viewport: Size): Placement {
  const left = clampInside(rect.left, size.width, viewport.width);
  const top = clampInside(rect.top + rect.height + BUBBLE_GAP, size.height, viewport.height);
  return { left, top, tailSide: 'top', tail: tailAlong(rect.left + rect.width / 2, left, size.width) };
}

/** Right of a card (tail left, toward its portrait), or left of it when the right edge is too close. */
function placeBesideCard(rect: Rect, size: Size, viewport: Size): Placement {
  const centre = rect.top + rect.height / 2;
  const top = clampInside(centre - size.height / 2, size.height, viewport.height);
  const right = rect.left + rect.width + BUBBLE_GAP;
  if (right + size.width <= viewport.width - BUBBLE_MARGIN) {
    return { left: right, top, tailSide: 'left', tail: tailAlong(centre, top, size.height) };
  }
  const left = clampInside(rect.left - BUBBLE_GAP - size.width, size.width, viewport.width);
  return { left, top, tailSide: 'right', tail: tailAlong(centre, top, size.height) };
}

export function placeBubble(target: BubbleTarget, size: Size, viewport: Size): Placement {
  if (target.kind === 'point') return placeAbovePoint(target.point, size, viewport);
  return target.side === 'below'
    ? placeBelowCard(target.rect, size, viewport)
    : placeBesideCard(target.rect, size, viewport);
}
