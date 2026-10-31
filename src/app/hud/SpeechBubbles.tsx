// Speech bubbles over the HUD. By default a bubble opens beside the speaking seat card; when the integrator passes
// `anchors` (a token's head projected to viewport pixels, one entry per seat) it floats above that point instead.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeBubble, type BubbleTarget, type ScreenPoint } from './bubbleLayout';

const LEAVE_MS = 150;

/** What the view holds for a seat while it speaks (DioramaView's `Bubble` satisfies it). */
export interface BubbleLike {
  line: string;
}

export interface SpeechBubblesProps {
  /** One entry per seat: the line being spoken, or null. */
  bubbles: readonly (BubbleLike | null | undefined)[];
  /**
   * Optional anchors, one per seat, in viewport CSS pixels (re-render with fresh points as the camera or token
   * moves). A seat with no anchor falls back to its seat card.
   */
  anchors?: readonly (ScreenPoint | null | undefined)[];
}

function targetOf(seat: number, anchor: ScreenPoint | null | undefined): BubbleTarget | null {
  if (anchor) return { kind: 'point', point: anchor };
  const card = document.querySelector(`[data-testid="seat-card-${seat}"]`);
  if (!card) return null;
  const { left, top, width, height } = card.getBoundingClientRect();
  // On a landscape phone the cards are small chips in the corner; the bubble hangs below them.
  const side = window.innerHeight <= 520 ? 'below' : 'right';
  return { kind: 'card', rect: { left, top, width, height }, side };
}

interface SeatBubbleProps {
  seat: number;
  bubble: BubbleLike | null | undefined;
  anchor: ScreenPoint | null | undefined;
}

function SeatBubble({ seat, bubble, anchor }: SeatBubbleProps) {
  const box = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<BubbleLike | null>(null);
  if (bubble && held !== bubble) setHeld(bubble);
  const leaving = !bubble && held !== null;

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setHeld(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // Placement is DOM geometry (the bubble's own size), so it is written straight to the element after each render.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || !held) return;
    const target = targetOf(seat, anchor);
    if (!target) return;
    const size = { width: element.offsetWidth, height: element.offsetHeight };
    const placed = placeBubble(target, size, { width: window.innerWidth, height: window.innerHeight });
    element.style.left = `${placed.left}px`;
    element.style.top = `${placed.top}px`;
    element.style.setProperty('--tail', `${placed.tail}px`);
    element.dataset.tail = placed.tailSide;
  });

  if (!held) return null;
  return (
    <div
      ref={box}
      className={`bubble${leaving ? ' leaving' : ''}`}
      data-testid={`bubble-${seat}`}
      role="status"
      data-tail="left"
    >
      <span className="bubble-text">{held.line}</span>
    </div>
  );
}

export function SpeechBubbles({ bubbles, anchors }: SpeechBubblesProps) {
  return (
    <div className="bubble-layer">
      {bubbles.map((bubble, seat) => (
        <SeatBubble key={seat} seat={seat} bubble={bubble} anchor={anchors?.[seat]} />
      ))}
    </div>
  );
}
