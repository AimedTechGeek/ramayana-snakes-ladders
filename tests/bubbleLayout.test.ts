import { describe, expect, it } from 'vitest';
import { BUBBLE_GAP, BUBBLE_MARGIN, placeBubble } from '../src/app/hud/bubbleLayout';

const VIEWPORT = { width: 844, height: 390 };
const SIZE = { width: 200, height: 40 };

describe('placeBubble', () => {
  it('Bubble_AboveATokenPoint_Should_SitAboveItWithTheTailDown', () => {
    const placed = placeBubble({ kind: 'point', point: { x: 400, y: 200 } }, SIZE, VIEWPORT);
    expect(placed.tailSide).toBe('bottom');
    expect(placed.top).toBe(200 - BUBBLE_GAP - SIZE.height);
    expect(placed.left).toBe(300);
    expect(placed.tail).toBe(100);
  });

  it('Bubble_PointNearTheLeftEdge_Should_StayInsideAndKeepTheTailOnThePoint', () => {
    const placed = placeBubble({ kind: 'point', point: { x: 20, y: 200 } }, SIZE, VIEWPORT);
    expect(placed.left).toBe(BUBBLE_MARGIN);
    expect(placed.tail).toBe(14);
  });

  it('Bubble_PointNearTheRightEdge_Should_StayInsideTheViewport', () => {
    const placed = placeBubble({ kind: 'point', point: { x: 840, y: 200 } }, SIZE, VIEWPORT);
    expect(placed.left + SIZE.width).toBe(VIEWPORT.width - BUBBLE_MARGIN);
    expect(placed.tail).toBe(SIZE.width - 14);
  });

  it('Bubble_PointNearTheTop_Should_FlipBelowWithTheTailUp', () => {
    const placed = placeBubble({ kind: 'point', point: { x: 400, y: 30 } }, SIZE, VIEWPORT);
    expect(placed.tailSide).toBe('top');
    expect(placed.top).toBe(30 + BUBBLE_GAP);
  });

  it('Bubble_BesideACard_Should_SitOnItsRightEdgeWithTheTailTowardThePortrait', () => {
    const card = { left: 24, top: 88, width: 240, height: 72 };
    const placed = placeBubble({ kind: 'card', rect: card }, SIZE, VIEWPORT);
    expect(placed.tailSide).toBe('left');
    expect(placed.left).toBe(24 + 240 + BUBBLE_GAP);
    expect(placed.top).toBe(88 + 36 - 20);
    expect(placed.tail).toBe(20);
  });

  it('Bubble_CardTooCloseToTheRightEdge_Should_OpenOnItsLeft', () => {
    const card = { left: 700, top: 100, width: 120, height: 40 };
    const placed = placeBubble({ kind: 'card', rect: card }, SIZE, VIEWPORT);
    expect(placed.tailSide).toBe('right');
    expect(placed.left + SIZE.width).toBeLessThanOrEqual(card.left - BUBBLE_GAP);
  });

  it('Bubble_CardAtTheBottom_Should_ClampInsideTheViewportHeight', () => {
    const card = { left: 24, top: 380, width: 100, height: 40 };
    const placed = placeBubble({ kind: 'card', rect: card }, SIZE, VIEWPORT);
    expect(placed.top + SIZE.height).toBe(VIEWPORT.height - BUBBLE_MARGIN);
  });

  it('Bubble_BelowACard_Should_HangUnderItWithTheTailUpOnItsCentre', () => {
    const card = { left: 8, top: 8, width: 96, height: 40 };
    const placed = placeBubble({ kind: 'card', rect: card, side: 'below' }, SIZE, VIEWPORT);
    expect(placed.tailSide).toBe('top');
    expect(placed.top).toBe(8 + 40 + BUBBLE_GAP);
    expect(placed.left).toBe(8);
    expect(placed.tail).toBe(48);
  });
});
