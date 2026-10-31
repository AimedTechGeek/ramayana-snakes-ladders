// Sita's six face frames (T44 4.2, 4.4 R2): the same atlas layout and patch coordinates as every hero, painted with her
// own features: long lashes, thin arched brows, a rose bindi and rose lips. Restrained by rule: `scared` keeps the idle
// brows (concern, not alarm), `sad` has a lowered gaze, and no frame has sweat, tears or sparkles.
// Browser only (canvas).

import { FACE_FRAMES } from './heroClips';
import {
  ATLAS_H,
  ATLAS_W,
  FRAME_W,
  PX_X,
  PX_Z,
  blush,
  curve,
  ellipse,
  glossyEye,
  px,
  stroke,
  type Ctx,
} from './heroFace';

const ROSE = '#D15587';
const ROSE_DEEP = '#B3426F';
const LID = '#E4AE86'; // her skin in shade, for a lowered lid
const EYE_Z = 62.5;

type Look = (typeof FACE_FRAMES)[number];

/** Thin arched brows; `inner` raises the inner end (a soft worry), `lift` raises the whole brow. */
function arches(ctx: Ctx, index: number, lift: number, inner = 0): void {
  stroke(ctx, 0.42);
  for (const sx of [-1, 1]) {
    const z0 = 65.0 + lift;
    curve(ctx, index, [sx * 1.4, z0 + inner], [sx * 3.0, z0 + 0.95], [sx * 4.7, z0 - 0.25]);
    ctx.stroke();
  }
}

/** Upper lid hugging the eye with two lash flicks at the outer corner: the lash that makes the eye hers. */
function lashes(ctx: Ctx, index: number, closed: boolean): void {
  for (const sx of [-1, 1]) {
    const inner = sx * 1.55;
    const outer = sx * 4.3;
    const z = closed ? EYE_Z - 0.1 : EYE_Z + 0.55;
    const peak = closed ? z - 0.95 : z + 1.55;
    stroke(ctx, closed ? 0.44 : 0.52);
    curve(ctx, index, [inner, z - 0.35], [sx * 2.9, 2 * peak - z + 0.3], [outer, z - 0.45]);
    ctx.stroke();
    stroke(ctx, 0.4);
    for (const [dx, dz] of [[0.6, 0.75]] as const) {
      curve(ctx, index, [outer - sx * 0.15, z - 0.45], [outer + sx * dx * 0.6, z - 0.2 + dz * 0.4], [outer + sx * dx, z - 0.2 + dz]);
      ctx.stroke();
    }
  }
}

function bindi(ctx: Ctx, index: number): void {
  ellipse(ctx, index, 0, 64.2, 0.42, 0.5);
  ctx.fillStyle = ROSE_DEEP;
  ctx.fill();
}

/** A closed, gentle mouth: rose lips under a fine ink line. `width`/`depth` shape the smile (negative depth = a sigh). */
function lips(ctx: Ctx, index: number, width: number, depth: number, z = 56.9): void {
  stroke(ctx, 0.7, ROSE);
  curve(ctx, index, [-width, z + 0.35], [0, z - depth * 1.1], [width, z + 0.35]);
  ctx.stroke();
  stroke(ctx, 0.3);
  curve(ctx, index, [-width, z + 0.35], [0, z - depth * 1.1], [width, z + 0.35]);
  ctx.stroke();
}

function openEyes(ctx: Ctx, index: number, rx: number, rz: number, z = EYE_Z): void {
  glossyEye(ctx, index, -2.9, z, rx, rz, true);
  glossyEye(ctx, index, 2.9, z, rx, rz, true);
}

function drawSitaFrame(ctx: Ctx, index: number, look: Look): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(index * FRAME_W, 0, FRAME_W, ATLAS_H);
  ctx.clip();
  switch (look) {
    case 'idle':
      openEyes(ctx, index, 1.2, 1.65);
      lashes(ctx, index, false);
      arches(ctx, index, 0.0);
      lips(ctx, index, 1.7, 0.75);
      blush(ctx, index, 0.28);
      break;
    case 'blink':
      lashes(ctx, index, true);
      arches(ctx, index, -0.1);
      lips(ctx, index, 1.7, 0.75);
      blush(ctx, index, 0.28);
      break;
    case 'happy':
      stroke(ctx, 0.6);
      for (const sx of [-1, 1]) {
        curve(ctx, index, [sx * 1.4, EYE_Z - 0.4], [sx * 2.9, EYE_Z + 1.7], [sx * 4.4, EYE_Z - 0.4]);
        ctx.stroke();
      }
      arches(ctx, index, 0.45);
      lips(ctx, index, 2.3, 1.3);
      blush(ctx, index, 0.5);
      break;
    case 'excited':
      openEyes(ctx, index, 1.35, 1.8);
      lashes(ctx, index, false);
      arches(ctx, index, 0.55);
      lips(ctx, index, 2.5, 1.35, 56.8);
      blush(ctx, index, 0.5);
      break;
    case 'scared':
      // concern, not alarm (R2): the idle brows, eyes a touch wider, a quiet mouth
      openEyes(ctx, index, 1.3, 1.78);
      lashes(ctx, index, false);
      arches(ctx, index, 0.0);
      lips(ctx, index, 1.1, -0.05);
      blush(ctx, index, 0.18);
      break;
    case 'sad':
      // a lowered gaze: heavy upper lids, brows eased, a soft downward mouth; no tears
      openEyes(ctx, index, 1.3, 1.55, EYE_Z - 0.25);
      ctx.fillStyle = LID;
      for (const sx of [-1, 1]) {
        const [cx, cy] = px(index, sx * 2.9, EYE_Z + 0.45);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 1.55 * PX_X, 1.05 * PX_Z, 0, Math.PI, 2 * Math.PI);
        ctx.fill();
      }
      lashes(ctx, index, true);
      arches(ctx, index, -0.1, 0.35);
      lips(ctx, index, 1.3, -0.55, 56.6);
      blush(ctx, index, 0.16);
      break;
  }
  bindi(ctx, index);
  ctx.restore();
}

export function drawSitaAtlas(ctx: Ctx): void {
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  FACE_FRAMES.forEach((look, index) => drawSitaFrame(ctx, index, look));
}
