// Runtime scale of the figures on the board (T45.2). The GLBs are not rebuilt: a hero's root and a snake's root are
// multiplied by these at render time, and every length derived from the figure's size (stride, lit ring, shadow, bubble
// anchor, camera heights, the snake's mouth points) goes through them too.
//
// The cinematic bite (T45.4) grows the snake on top of `SNAKE_SCALE`: multiply `SNAKE_SCALE * growth`, never replace it.

/** A hero's scale against the authored GLB (1.43 u tall) and the existing `token.scale` (the bite shrinks that one). */
export const HERO_SCALE = 0.55;
/**
 * A snake's scale against the authored GLB, about the coil centre (`snakeAnchor`). Full size by owner decision
 * (2026-11-04): the snakes are the board's theme pieces and must stay prominent next to the blocks and the smaller
 * heroes. Respect rule R9 ("heroes above villains", T44 4.4) is therefore retired on the board: at HERO_SCALE 0.55 a
 * hero's shoulder (0.92 x 0.55 = 0.51 u) is below most snake heads (0.52-0.75 u). The GLB-level R9 tests still hold at
 * rest scale; every other snake respect rule (no hood, one head, no halo, nothing deity-like, not gory) is unchanged.
 */
export const SNAKE_SCALE = 1;
