import { describe, expect, it } from 'vitest';
import {
  BOARD_VIEWPORT,
  BOARD_WORLD,
  DRAG_THRESHOLD,
  FOLLOW_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  clampView,
  clampZoom,
  easeFactor,
  easeView,
  fitView,
  followTarget,
  isDrag,
  keepInView,
  panBy,
  pinchView,
  viewToWorld,
  worldToView,
  zoomToward,
} from '../src/game/boardCamera';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('clampZoom', () => {
  it('clampZoom_AboveMax_Should_ReturnMax', () => expect(clampZoom(9)).toBe(MAX_ZOOM));
  it('clampZoom_BelowFit_Should_ReturnFit', () => expect(clampZoom(0.2)).toBe(MIN_ZOOM));
  it('clampZoom_NotANumber_Should_ReturnFit', () => expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM));
});

describe('zoomToward', () => {
  it('zoomToward_cursorPoint_Should_StayUnderCursor', () => {
    const start = followTarget({ x: 300, y: 300 }, 1.5);
    const cursor = { x: 600, y: 120 };
    const before = viewToWorld(start, cursor);
    const after = zoomToward(start, 2.4, cursor);
    const now = viewToWorld(after, cursor);
    near(now.x, before.x);
    near(now.y, before.y);
  });
  it('zoomToward_BeyondMax_Should_StopAtMaxZoom', () => {
    expect(zoomToward(fitView(), 50, { x: 700, y: 650 }).zoom).toBe(MAX_ZOOM);
  });
  it('zoomToward_BelowFit_Should_ReturnTheFitView', () => {
    const zoomedIn = zoomToward(fitView(), 2.5, { x: 700, y: 650 });
    expect(zoomToward(zoomedIn, 0.5, { x: 100, y: 100 })).toEqual(fitView());
  });
  it('zoomToward_BoardCorner_Should_KeepTheBoardEdgeAtTheViewportEdge', () => {
    const view = zoomToward(fitView(), 3, { x: 784, y: 720 });
    const corner = worldToView(view, { x: 784, y: 720 });
    near(corner.x, 784);
    near(corner.y, 720);
  });
});

describe('clampView', () => {
  it('clampView_PannedPastTheEdge_Should_KeepTheBoardInView', () => {
    const view = clampView({ zoom: 2, cx: -500, cy: 5000 });
    const topLeft = viewToWorld(view, { x: 0, y: 0 });
    const bottomRight = viewToWorld(view, { x: BOARD_VIEWPORT.width, y: BOARD_VIEWPORT.height });
    near(topLeft.x, 0);
    near(bottomRight.y, BOARD_WORLD.height);
  });
  it('clampView_AtFit_Should_CentreOnTheBoard', () => {
    expect(clampView({ zoom: 1, cx: 10, cy: 10 })).toEqual(fitView());
  });
});

describe('followTarget', () => {
  it('followTarget_TokenMidBoard_Should_CentreItAtFollowZoom', () => {
    const view = followTarget({ x: 400, y: 300 });
    expect(view).toEqual({ zoom: FOLLOW_ZOOM, cx: 400, cy: 300 });
  });
  it('followTarget_TokenInACorner_Should_NotShowOutsideTheBoard', () => {
    const view = followTarget({ x: 10, y: 710 });
    const bottomLeft = viewToWorld(view, { x: 0, y: BOARD_VIEWPORT.height });
    near(bottomLeft.x, 0);
    near(bottomLeft.y, BOARD_WORLD.height);
  });
});

describe('panBy', () => {
  it('panBy_DragRight_Should_MoveTheBoardWithThePointer', () => {
    const start = followTarget({ x: 400, y: 360 }, 2);
    const grab = { x: 300, y: 300 };
    const grabbed = viewToWorld(start, grab);
    const view = panBy(start, grab, { x: 340, y: 320 });
    const under = worldToView(view, grabbed);
    near(under.x, 340);
    near(under.y, 320);
  });
});

describe('pinchView', () => {
  it('pinchView_FingersApart_Should_ZoomInByTheDistanceRatio', () => {
    const start = followTarget({ x: 400, y: 360 }, 1.5);
    const mid = { x: 392, y: 360 };
    near(pinchView(start, mid, 100, mid, 150).zoom, 2.25);
  });
  it('pinchView_MidpointMoves_Should_KeepTheSameWorldPointUnderIt', () => {
    const start = followTarget({ x: 400, y: 360 }, 1.5);
    const mid = { x: 300, y: 200 };
    const grabbed = viewToWorld(start, mid);
    const view = pinchView(start, mid, 100, { x: 340, y: 240 }, 120);
    const under = worldToView(view, grabbed);
    near(under.x, 340);
    near(under.y, 240);
  });
});

describe('isDrag', () => {
  it('isDrag_MovementWithinThreshold_Should_BeATap', () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 100 + DRAG_THRESHOLD - 1, y: 100 })).toBe(false);
  });
  it('isDrag_MovementBeyondThreshold_Should_BeADrag', () => {
    expect(isDrag({ x: 100, y: 100 }, { x: 100, y: 100 + DRAG_THRESHOLD + 1 })).toBe(true);
  });
});

describe('easeView', () => {
  const goal = followTarget({ x: 500, y: 400 });
  it('easeView_ZeroDuration_Should_JumpToTheGoal', () => {
    expect(easeView(fitView(), goal, 16, 0)).toEqual(goal);
  });
  it('easeView_AfterTheEaseTime_Should_BeNearlyThere', () => {
    let view = fitView();
    for (let t = 0; t < 350; t += 16) view = easeView(view, goal, 16, 350);
    expect(Math.abs(view.zoom - goal.zoom)).toBeLessThan(0.15);
    expect(Math.hypot(view.cx - goal.cx, view.cy - goal.cy)).toBeLessThan(15);
  });
  it('easeFactor_LongerFrame_Should_CoverMoreDistance', () => {
    expect(easeFactor(32, 350)).toBeGreaterThan(easeFactor(16, 350));
  });
});

describe('keepInView', () => {
  it('keepInView_TokenNearTheViewportEdge_Should_PanItBackInside', () => {
    const view = followTarget({ x: 400, y: 360 }, 2);
    const token = { x: 400 + 300, y: 360 }; // 600 px right of centre on screen: outside the 784 px viewport
    const next = keepInView(view, token);
    const at = worldToView(next, token);
    expect(at.x).toBeLessThanOrEqual(784 * 0.8 + 1e-6);
  });
  it('keepInView_TokenWellInside_Should_LeaveTheViewAlone', () => {
    const view = followTarget({ x: 400, y: 360 }, 2);
    expect(keepInView(view, { x: 410, y: 370 })).toBe(view);
  });
});
