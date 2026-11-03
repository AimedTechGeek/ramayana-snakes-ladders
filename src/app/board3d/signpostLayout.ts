// Stage signposts (T46.6): the pure layout, where each stage's wooden signpost stands on the stage's first block and
// which atlas cell its board reads, plus the canvas that paints the atlas (a wooden board per stage, brass nails, the
// name painted in Eczar and the Kanda beneath, in the current language). Drawn by Signposts.tsx as one merged mesh.
// Units: board units (1 u = one block pitch), three-space axes (x right, y up, z toward the viewer). No three, no React.

import { FINAL_SQUARE } from '../../game/board/blockRules';
import { STAGES, type StageId } from '../../game/stages';
import { WATER_LIFT, blockTopY, isWaterSquare, squareCentre } from './boardLayout';
import { placeRect, type Point, type Polygon, type Rect } from './walkways';

/** The painted board: a prop's scale, a bit over half a hero's height (heroes stand ~0.79 u, blocks are 0.92 u). */
export const SIGN_BOARD_WIDTH = 0.42;
export const SIGN_BOARD_HEIGHT = 0.21;
export const SIGN_BOARD_DEPTH = 0.025;
/** The board's lower edge above the post's foot. */
export const SIGN_BOARD_BOTTOM = 0.15;
/** The post (square section); the cap on top of it ends at the signpost's full height. */
export const SIGN_POST = 0.04;
export const SIGN_HEIGHT = 0.4;
/** The flat stone the post is footed in. */
export const SIGN_FOOT = 0.07;
export const SIGN_FOOT_HEIGHT = 0.025;

export interface SignpostSpot {
  id: StageId;
  /** The stage's first square: the block the signpost stands on. */
  square: number;
  /** The post's foot on the ground plan, three units. */
  at: Point;
  /** Heading about the vertical axis (three.js rotation.y), radians: 0 faces +z, FIT_AZIMUTH faces the default camera. */
  yaw: number;
  /** The board's centre from the post along the board (u): the board is nailed off-centre where a lane runs close. */
  boardOffset: number;
}

const DEG = Math.PI / 180;

/**
 * Where each signpost stands, relative to its block's centre (x, z in u), its heading in degrees and the board's
 * offset from the post. The spots are fixed by hand and checked by tests/signposts.test.ts: off every walking lane and
 * fan slot, clear of snake coils, bridge abutments, the gate, the palace and the throne, hiding no number chip and not
 * the throne from the default camera. Where a block has room behind its token field (1, 2, 109, 121) the sign stands
 * on the back edge; the first blocks of rows reached by a stair from the front (37, 49, 85) are crossed by the arrival
 * lane, so their sign stands on the outer front corner with its board reaching out over the rim; the throne's stands in
 * front of the dais, clear of the empty throne.
 */
const SPOTS: Readonly<Record<StageId, { x: number; z: number; yaw: number; offset: number }>> = {
  start: { x: 0.06, z: -0.42, yaw: 8, offset: 0.15 },
  mithila: { x: 0.0, z: -0.42, yaw: 8, offset: 0.2 },
  ayodhya: { x: 0.4, z: 0.35, yaw: 0, offset: 0.08 },
  dandaka: { x: -0.36, z: 0.16, yaw: 22, offset: -0.1 },
  kishkindha: { x: 0.42, z: 0.24, yaw: 22, offset: 0 },
  sea: { x: 0.02, z: -0.42, yaw: 8, offset: 0.1 },
  lanka: { x: 0.06, z: -0.42, yaw: 8, offset: 0.15 },
  throne: { x: 0, z: 0.24, yaw: 22, offset: 0 },
};

/** One signpost per stage, on the stage's first square, in stage order. */
export function signpostSpots(): SignpostSpot[] {
  return STAGES.map((stage) => {
    const spot = SPOTS[stage.id];
    const [cx, cz] = squareCentre(stage.from);
    return {
      id: stage.id,
      square: stage.from,
      at: [cx + spot.x, cz + spot.z],
      yaw: spot.yaw * DEG,
      boardOffset: spot.offset,
    };
  });
}

/**
 * Height of a signpost's foot: the block top (terraces included), on a water block the bed under the surface, on the
 * throne's block the dais (`daisHeight`, propLayout.DAIS_HEIGHT, passed in so this module stays below propLayout).
 */
export function signpostFootY(square: number, daisHeight: number): number {
  const top = blockTopY(square) - (isWaterSquare(square) ? WATER_LIFT : 0);
  return square === FINAL_SQUARE ? top + daisHeight : top;
}

/** The solid parts of a signpost on the ground plan, local to the post's foot: the foot stone, then the board. */
export function signpostParts(boardOffset: number): Rect[] {
  const foot = SIGN_FOOT / 2;
  const front = SIGN_POST / 2;
  return [
    { x: [-foot, foot], z: [-foot, foot] },
    {
      x: [boardOffset - SIGN_BOARD_WIDTH / 2, boardOffset + SIGN_BOARD_WIDTH / 2],
      z: [front, front + SIGN_BOARD_DEPTH],
    },
  ];
}

/** A signpost's ground polygons (where a walker would run into it). */
export function signpostPolygons(spot: SignpostSpot): Polygon[] {
  return signpostParts(spot.boardOffset).map((part) => placeRect(part, spot.at, spot.yaw, 1));
}

/** Every signpost's ground polygons (the scenery pass keeps props clear of them). */
export const SIGNPOST_SOLIDS: readonly Polygon[] = signpostSpots().flatMap(signpostPolygons);

// ---------------------------------------------------------------- the atlas

/** 512 x 512: 2 columns x 4 rows of 256 x 128 cells, one board per stage (2:1, the board's own aspect). */
export const SIGN_ATLAS_SIZE = 512;
export const SIGN_COLUMNS = 2;
export const SIGN_CELL_WIDTH = SIGN_ATLAS_SIZE / SIGN_COLUMNS;
export const SIGN_CELL_HEIGHT = SIGN_ATLAS_SIZE / 4;
export const SIGN_NAME_FONT = '600 46px Eczar';
export const SIGN_SUB_FONT = '500 27px Eczar';

export interface SignLabel {
  name: string;
  /** The Kanda, or the one-line story when the stage has no Kanda (the start block). */
  sub: string;
}

/** Lower-left UV of a board's atlas cell and the cell's UV size (texture v runs bottom-up). */
export function signUvCell(index: number): { u: number; v: number; width: number; height: number } {
  const width = SIGN_CELL_WIDTH / SIGN_ATLAS_SIZE;
  const height = SIGN_CELL_HEIGHT / SIGN_ATLAS_SIZE;
  const column = index % SIGN_COLUMNS;
  const row = Math.floor(index / SIGN_COLUMNS);
  return { u: column * width, v: 1 - (row + 1) * height, width, height };
}

const PAD = 20;
const BORDER = 5;
const PAINT = '#F6E7C1';
const PAINT_SUB = '#EAD39C';

function nail(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#7A5A1E';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 0.8, y - 0.8, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#E2C070';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 1.4, y - 1.4, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF2C4';
  ctx.fill();
}

/** Two planks of warm wood with a seam between them, a little grain, a dark worn edge and a brass nail per corner. */
function paintBoard(ctx: CanvasRenderingContext2D, x: number, y: number, index: number): void {
  const w = SIGN_CELL_WIDTH;
  const h = SIGN_CELL_HEIGHT;
  ctx.fillStyle = '#4A2E17';
  ctx.fillRect(x, y, w, h);
  for (const [top, bottom, light, dark] of [
    [y + BORDER, y + h / 2, '#9A6735', '#87572D'],
    [y + h / 2, y + h - BORDER, '#8E5C30', '#7A4C27'],
  ] as const) {
    const plank = ctx.createLinearGradient(0, top, 0, bottom);
    plank.addColorStop(0, light);
    plank.addColorStop(1, dark);
    ctx.fillStyle = plank;
    ctx.fillRect(x + BORDER, top, w - 2 * BORDER, bottom - top);
  }
  // grain: thin wavy strokes, the same on every redraw (phased by the cell)
  ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    const gy = y + BORDER + 6 + k * ((h - 2 * BORDER - 12) / 8);
    ctx.strokeStyle = k % 3 === 0 ? 'rgba(60, 34, 14, 0.35)' : 'rgba(255, 220, 170, 0.12)';
    ctx.beginPath();
    for (let gx = 0; gx <= w - 2 * BORDER; gx += 8) {
      const wave = Math.sin(gx * 0.045 + k * 1.7 + index * 2.3) * 1.6;
      if (gx === 0) ctx.moveTo(x + BORDER + gx, gy + wave);
      else ctx.lineTo(x + BORDER + gx, gy + wave);
    }
    ctx.stroke();
  }
  // the seam between the planks, with a pale lip under it
  ctx.fillStyle = 'rgba(40, 22, 8, 0.7)';
  ctx.fillRect(x + BORDER, y + h / 2 - 1.5, w - 2 * BORDER, 3);
  ctx.fillStyle = 'rgba(255, 225, 180, 0.18)';
  ctx.fillRect(x + BORDER, y + h / 2 + 1.5, w - 2 * BORDER, 1.5);
  for (const [nx, ny] of [
    [x + 14, y + 14],
    [x + w - 14, y + 14],
    [x + 14, y + h - 14],
    [x + w - 14, y + h - 14],
  ] as const)
    nail(ctx, nx, ny);
}

/** Sets `font` (`<weight> <size>px <family>`), shrunk a pixel at a time until `text` fits `width`. */
function fitFont(ctx: CanvasRenderingContext2D, font: string, text: string, width: number): void {
  ctx.font = font;
  const match = /^(\d+) (\d+)px (.+)$/.exec(font);
  if (!match) return;
  for (let size = Number(match[2]); size > 12 && ctx.measureText(text).width > width; size--)
    ctx.font = `${match[1]} ${size - 1}px ${match[3]}`;
}

/** Painted lettering: a dark shadow under the paint so it reads on the wood. */
function paint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
  ctx.fillStyle = 'rgba(30, 16, 4, 0.75)';
  ctx.fillText(text, x + 1.5, y + 2);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}

/** Paints the atlas: one board per label in its cell, the name large on the upper plank, the Kanda on the lower. */
export function drawSignAtlas(canvas: HTMLCanvasElement, labels: readonly SignLabel[]): void {
  canvas.width = canvas.height = SIGN_ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, SIGN_ATLAS_SIZE, SIGN_ATLAS_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, index) => {
    const x = (index % SIGN_COLUMNS) * SIGN_CELL_WIDTH;
    const y = Math.floor(index / SIGN_COLUMNS) * SIGN_CELL_HEIGHT;
    paintBoard(ctx, x, y, index);
    const centre = x + SIGN_CELL_WIDTH / 2;
    const width = SIGN_CELL_WIDTH - 2 * PAD;
    fitFont(ctx, SIGN_NAME_FONT, label.name, width);
    if (!label.sub) {
      paint(ctx, label.name, centre, y + SIGN_CELL_HEIGHT / 2, PAINT);
      return;
    }
    paint(ctx, label.name, centre, y + SIGN_CELL_HEIGHT * 0.37, PAINT);
    fitFont(ctx, SIGN_SUB_FONT, label.sub, width);
    paint(ctx, label.sub, centre, y + SIGN_CELL_HEIGHT * 0.75, PAINT_SUB);
  });
}
