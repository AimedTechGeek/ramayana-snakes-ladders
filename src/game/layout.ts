// Screen geometry for the 1280x720 landscape canvas. Pure functions, no Phaser, so they are unit-tested.

export const CANVAS = { width: 1280, height: 720 } as const;
export const BOARD = { x: 24, y: 24, size: 672, cell: 56, columns: 12 } as const;
export const PANEL = { x: 720, y: 24, width: 536 } as const;
export const SEAT = { height: 120, gap: 8 } as const;
export const CONTROLS_Y = 552;

export interface Point {
  x: number;
  y: number;
}

/** Serpentine grid cell of a square (1..144): row 0 is the bottom row and runs left to right, row 1 runs back. */
export function gridOf(square: number): { row: number; column: number } {
  const index = square - 1;
  const row = Math.floor(index / BOARD.columns);
  const offset = index % BOARD.columns;
  return { row, column: row % 2 === 0 ? offset : BOARD.columns - 1 - offset };
}

/** Centre of a board square (1..144). Row 1 runs left to right from the bottom-left corner, row 2 back. */
export function squareCenter(square: number): Point {
  const { row, column } = gridOf(square);
  return {
    x: BOARD.x + column * BOARD.cell + BOARD.cell / 2,
    y: BOARD.y + BOARD.size - row * BOARD.cell - BOARD.cell / 2,
  };
}

/** 0-based board row of a square, bottom row = 0. */
export function rowOf(square: number): number {
  return Math.floor((square - 1) / BOARD.columns);
}

export function seatTop(seat: number): number {
  return PANEL.y + seat * (SEAT.height + SEAT.gap);
}

/** Where a token waits on its seat card before entering the board (square 0). */
export function seatTokenSpot(seat: number): Point {
  return { x: PANEL.x + PANEL.width - 28, y: seatTop(seat) + 58 };
}

const FAN: readonly (readonly Point[])[] = [
  [],
  [{ x: 0, y: 0 }],
  [
    { x: -12, y: 0 },
    { x: 12, y: 0 },
  ],
  [
    { x: -12, y: -12 },
    { x: 12, y: -12 },
    { x: 0, y: 12 },
  ],
  [
    { x: -12, y: -12 },
    { x: 12, y: -12 },
    { x: -12, y: 12 },
    { x: 12, y: 12 },
  ],
];

/** Offset for the i-th of `count` tokens sharing one square, so they never hide each other. */
export function fanOffset(i: number, count: number): Point {
  return FAN[Math.min(count, 4)]?.[i] ?? { x: 0, y: 0 };
}
