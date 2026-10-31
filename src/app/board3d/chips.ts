// Square-number chips (T44 spec 2.8): the pure sizing and atlas layout, plus the canvas that draws the atlas.

export const CHIP_WIDTH = 0.21;
export const CHIP_HEIGHT = 0.135;
export const ATLAS_SIZE = 1024;
export const ATLAS_GRID = 12;
export const ATLAS_CELL = ATLAS_SIZE / ATLAS_GRID;
export const CHIP_INK = '#2B2F5C';
export const CHIP_PARCHMENT = '#F3E3B8';

/** World scale of a chip at a camera distance: grows with distance so digits stay legible, capped at 2.5. */
export function chipScale(distance: number): number {
  return Math.min(2.5, Math.max(1, distance / 10));
}

/** Atlas cell of a square (row 0 at the top of the image). */
export function chipCell(square: number): { column: number; row: number } {
  const index = square - 1;
  return { column: index % ATLAS_GRID, row: Math.floor(index / ATLAS_GRID) };
}

/** Lower-left UV of a square's cell (texture v runs bottom-up, so the image's top row is the highest v). */
export function chipUvOrigin(square: number): [number, number] {
  const { column, row } = chipCell(square);
  return [column / ATLAS_GRID, 1 - (row + 1) / ATLAS_GRID];
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the 12 x 12 atlas: a parchment chip with a soft shadow and the number in ink, one cell per square. */
export function drawChipAtlas(canvas: HTMLCanvasElement): void {
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const padX = ATLAS_CELL * 0.05;
  const width = ATLAS_CELL - padX * 2;
  const height = (width * CHIP_HEIGHT) / CHIP_WIDTH;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let square = 1; square <= ATLAS_GRID * ATLAS_GRID; square++) {
    const { column, row } = chipCell(square);
    const x = column * ATLAS_CELL + padX;
    const y = row * ATLAS_CELL + (ATLAS_CELL - height) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(43,47,92,0.35)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = CHIP_PARCHMENT;
    roundedRect(ctx, x, y, width, height, height * 0.32);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(176,138,94,0.55)';
    roundedRect(ctx, x + 1, y + 1, width - 2, height - 2, height * 0.3);
    ctx.stroke();
    ctx.fillStyle = CHIP_INK;
    ctx.font = `700 ${height * 0.66}px Poppins, "Noto Sans", system-ui, sans-serif`;
    ctx.fillText(String(square), x + width / 2, y + height / 2 + height * 0.04);
  }
}
