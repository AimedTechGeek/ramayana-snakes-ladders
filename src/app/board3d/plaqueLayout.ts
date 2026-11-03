// Stage name plaques (T46.5): the pure layout, where each stage's brass plate hangs on the board's edge beside its
// first row and which atlas cell it reads, plus the canvas that draws the atlas (a brass plate per stage with the
// name engraved in Eczar and the Kanda beneath, in the current language). Drawn like the number chips: one quad per
// plaque, billboarded and scaled with distance in the shader (boardMaterials.plaqueMaterial), one draw call.

import { gridOf } from '../../game/layout';
import { STAGES, type StageId } from '../../game/stages';
import { RIM_HALF, SLAB_HALF, blockTopY, rowOf, squareCentre, terraceY } from './boardLayout';

/** World size of a plaque quad at scale 1 (the atlas cell's 8:1 aspect); the plate inside is as wide as its text. */
export const PLAQUE_WIDTH = 2.4;
export const PLAQUE_HEIGHT = 0.3;
export const PLAQUE_ATLAS_SIZE = 1024;
/** One cell per stage, stacked top to bottom. */
export const PLAQUE_CELL_HEIGHT = PLAQUE_ATLAS_SIZE / 8;
export const PLAQUE_NAME_FONT = '600 58px Eczar';
export const PLAQUE_SUB_FONT = '500 28px Eczar';
/** A plaque stands this far above the block tops of its row, so the row's first block never hides its foot. */
const LIFT = 0.02;

/** -1: the plate's left edge sits on the anchor (it hangs to the right); 0: its centre; 1: its right edge. */
export type Align = -1 | 0 | 1;

export interface PlaqueSpot {
  id: StageId;
  /** Where the plaque meets the board, three units. */
  position: [number, number, number];
  alignX: Align;
  /** -1: the plate's bottom edge sits on the anchor (it stands up); 1: its top edge (it hangs down). */
  alignY: Align;
}

export interface PlaqueLabel {
  name: string;
  /** The Kanda, or the one-line story when the stage has no Kanda (the start block). */
  sub: string;
  alignX: Align;
}

/**
 * Where the plaques hang. A row stage's plate stands on the rim beside its first row, on the side the row begins
 * (the boustrophedon's entry side), hanging outward over the plinth so it never covers the row's first block. The
 * start block's plate hangs down the slab's front face below the gate; the throne's stands behind the back row,
 * beside 144 and clear of the chhatra.
 */
export function plaqueSpots(): PlaqueSpot[] {
  return STAGES.map((stage) => {
    const first = stage.from;
    const [x, z] = squareCentre(first);
    if (stage.id === 'start')
      return { id: stage.id, position: [x, terraceY(0), SLAB_HALF], alignX: 0, alignY: 1 };
    if (stage.id === 'throne') {
      const [bx] = squareCentre(first - 1);
      return { id: stage.id, position: [bx, blockTopY(first) + LIFT, -RIM_HALF], alignX: 0, alignY: -1 };
    }
    const left = gridOf(first).column === 0;
    const y = blockTopY(first) + LIFT;
    return {
      id: stage.id,
      position: [left ? -RIM_HALF : RIM_HALF, y, z],
      alignX: left ? 1 : -1,
      alignY: -1,
    };
  });
}

/** Lower-left UV of a plaque's atlas cell (cell `index` from the top; texture v runs bottom-up). */
export function plaqueUvOrigin(index: number): [number, number] {
  return [0, 1 - ((index + 1) * PLAQUE_CELL_HEIGHT) / PLAQUE_ATLAS_SIZE];
}

/** A stage is reached once any of its squares is out of the fog. */
export function stageReached(id: StageId, revealed: ReadonlySet<number>): boolean {
  const stage = STAGES.find((candidate) => candidate.id === id);
  if (!stage) return false;
  for (let square = stage.from; square <= stage.to; square++) if (revealed.has(square)) return true;
  return false;
}

/** Row of a stage's first square (for tests and captures). */
export function plaqueRow(id: StageId): number {
  const stage = STAGES.find((candidate) => candidate.id === id);
  return stage ? rowOf(stage.from) : 0;
}

const EDGE = 8;
const PAD_X = 40;
const MIN_PLATE = 300;
const RADIUS = 14;
const BRASS_DARK = '#6B4D14';
const INK = '#3A2A0E';

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

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#8A6A2A';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 1.2, y - 1.2, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#F2DCA0';
  ctx.fill();
}

/** Engraved lettering: a pale lip below the stroke, the ink cut above it. */
function engrave(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.fillStyle = 'rgba(255, 244, 210, 0.55)';
  ctx.fillText(text, x, y + 1.5);
  ctx.fillStyle = INK;
  ctx.fillText(text, x, y);
}

/**
 * Draws the atlas: one brass plate per label in its cell, as wide as its text (at least MIN_PLATE), set against the
 * cell edge its alignment names so the quad's anchored edge is the plate's edge. The rest of the cell is clear.
 */
export function drawPlaqueAtlas(canvas: HTMLCanvasElement, labels: readonly PlaqueLabel[]): void {
  canvas.width = canvas.height = PLAQUE_ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, PLAQUE_ATLAS_SIZE, PLAQUE_ATLAS_SIZE);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  labels.forEach((label, index) => {
    const top = index * PLAQUE_CELL_HEIGHT;
    ctx.font = PLAQUE_NAME_FONT;
    const nameWidth = ctx.measureText(label.name).width;
    ctx.font = PLAQUE_SUB_FONT;
    const subWidth = label.sub ? ctx.measureText(label.sub).width : 0;
    const width = Math.min(
      PLAQUE_ATLAS_SIZE - 2 * EDGE,
      Math.max(MIN_PLATE, Math.max(nameWidth, subWidth) + 2 * PAD_X),
    );
    const x =
      label.alignX === -1
        ? EDGE
        : label.alignX === 1
          ? PLAQUE_ATLAS_SIZE - EDGE - width
          : (PLAQUE_ATLAS_SIZE - width) / 2;
    const y = top + 8;
    const height = PLAQUE_CELL_HEIGHT - 16;

    // the plate: brass with a soft cast shadow, a dark bevel and a pale inner lip
    ctx.save();
    ctx.shadowColor = 'rgba(30, 20, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    const brass = ctx.createLinearGradient(0, y, 0, y + height);
    brass.addColorStop(0, '#E8C878');
    brass.addColorStop(0.45, '#C99B42');
    brass.addColorStop(0.75, '#B98A36');
    brass.addColorStop(1, '#D9B45C');
    ctx.fillStyle = brass;
    roundedRect(ctx, x, y, width, height, RADIUS);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = BRASS_DARK;
    roundedRect(ctx, x + 1.5, y + 1.5, width - 3, height - 3, RADIUS - 1);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 245, 210, 0.6)';
    roundedRect(ctx, x + 5, y + 5, width - 10, height - 10, RADIUS - 4);
    ctx.stroke();
    for (const [rx, ry] of [
      [x + 16, y + 16],
      [x + width - 16, y + 16],
      [x + 16, y + height - 16],
      [x + width - 16, y + height - 16],
    ])
      rivet(ctx, rx!, ry!);

    const centreX = x + width / 2;
    ctx.font = PLAQUE_NAME_FONT;
    if (label.sub) {
      engrave(ctx, label.name, centreX, y + height * 0.37);
      ctx.font = PLAQUE_SUB_FONT;
      engrave(ctx, label.sub, centreX, y + height * 0.79);
    } else {
      engrave(ctx, label.name, centreX, y + height / 2);
    }
  });
}
