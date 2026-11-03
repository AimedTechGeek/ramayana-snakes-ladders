// Runtime scale of the figures on the board (T45.2). The GLBs are not rebuilt: a hero's root and a snake's root are
// multiplied by these at render time, and every length derived from the figure's size (stride, lit ring, shadow, bubble
// anchor, camera heights, the snake's mouth points) goes through them too.
//
// The cinematic bite (T45.4) grows the snake on top of `SNAKE_SCALE`: multiply `SNAKE_SCALE * growth`, never replace it.

/** A hero's scale against the authored GLB (1.43 u tall) and the existing `token.scale` (the bite shrinks that one). */
export const HERO_SCALE = 0.55;
/** A snake's scale against the authored GLB, about the coil centre (`snakeAnchor`). */
export const SNAKE_SCALE = 0.55;
