// The face atlas of a clay hero (T44 4.2): six expression frames (idle, blink, happy, excited, scared, sad) painted
// with soft clay-toy features on one transparent 1024 x 192 canvas, drawn at runtime (zero download). The GLB carries
// a curved face patch whose UVs map its (x, z) rectangle to 0..1; Hero shows one frame by moving the texture offset.
// Browser only (canvas); the frame order is `FACE_FRAMES` in heroClips.ts.

import { CanvasTexture, SRGBColorSpace } from 'three';
import { FACE_FRAMES } from './heroClips';

export const ATLAS_W = 1024;
export const ATLAS_H = 192;
const FRAME_W = ATLAS_W / FACE_FRAMES.length;
/** Pixels per design unit on the patch (x +-6.2, z 55.2..67.4 in the Blender build); features stay inside +-5.2 so mip levels never bleed a neighbouring frame in. */
const PX_X = FRAME_W / 12.4;
const PX_Z = ATLAS_H / 12.2;
const INK = '#2a1a0f';

type Ctx = CanvasRenderingContext2D;
type Look = 'idle' | 'blink' | 'happy' | 'excited' | 'scared' | 'sad';

/**
 * Two face sets over the same atlas layout. 'restrained' is for Rama, Sita and Bharata (T44 4.4 R2, T46): `scared` keeps the idle
 * brows (concern, not fright), no sweat drop, no tear, no sparkles, `excited` is a calm raised-brow smile. The other
 * heroes keep the comic set (Lakshmana and Hanuman, R4).
 */
export type FaceSet = 'comic' | 'restrained';
export const RESTRAINED_HEROES: readonly string[] = ['rama', 'sita', 'bharata'];
export function faceSetOf(hero: string): FaceSet {
  return RESTRAINED_HEROES.includes(hero) ? 'restrained' : 'comic';
}

/** What a frame draws, as data (Vitest asserts R2 on this without a canvas). */
export interface FaceSpec {
  sweatDrop: boolean;
  tear: boolean;
  sparkles: boolean;
  /** Brow tilt and lift of the frame; `scared` of the restrained set equals `idle`. */
  browTilt: number;
  browLift: number;
}

export function faceSpec(set: FaceSet, look: Look): FaceSpec {
  if (set === 'restrained') {
    const calm = { sweatDrop: false, tear: false, sparkles: false };
    switch (look) {
      case 'happy':
        return { ...calm, browTilt: 0.05, browLift: 0.4 };
      case 'excited':
        return { ...calm, browTilt: 0.05, browLift: 0.6 };
      case 'sad':
        return { ...calm, browTilt: 0.1, browLift: -0.1 };
      default: // idle, blink, scared
        return { ...calm, browTilt: 0.12, browLift: look === 'blink' ? -0.1 : 0 };
    }
  }
  switch (look) {
    case 'idle':
      return { sweatDrop: false, tear: false, sparkles: false, browTilt: 0.35, browLift: 0 };
    case 'blink':
      return { sweatDrop: false, tear: false, sparkles: false, browTilt: 0.3, browLift: -0.1 };
    case 'happy':
      return { sweatDrop: false, tear: false, sparkles: false, browTilt: 0.05, browLift: 0.5 };
    case 'excited':
      return { sweatDrop: false, tear: false, sparkles: true, browTilt: -0.15, browLift: 0.85 };
    case 'scared':
      return { sweatDrop: true, tear: false, sparkles: false, browTilt: -0.55, browLift: 0.9 };
    case 'sad':
      return { sweatDrop: false, tear: true, sparkles: false, browTilt: 0, browLift: 0 };
  }
}

/** Patch design coordinates -> canvas pixels inside frame `index`. */
function px(index: number, x: number, z: number): [number, number] {
  return [index * FRAME_W + FRAME_W / 2 + x * PX_X, ATLAS_H - (z - 55.2) * PX_Z];
}

function stroke(ctx: Ctx, width: number, colour = INK): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width * PX_X;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function path(ctx: Ctx, index: number, pts: [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, z], i) => {
    const [cx, cy] = px(index, x, z);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
}

function curve(ctx: Ctx, index: number, a: [number, number], c: [number, number], b: [number, number]): void {
  const [ax, ay] = px(index, ...a);
  const [cx, cy] = px(index, ...c);
  const [bx, by] = px(index, ...b);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo(cx, cy, bx, by);
}

function ellipse(ctx: Ctx, index: number, x: number, z: number, rx: number, rz: number): void {
  const [cx, cy] = px(index, x, z);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * PX_X, rz * PX_Z, 0, 0, Math.PI * 2);
}

function glossyEye(
  ctx: Ctx,
  index: number,
  x: number,
  z: number,
  rx: number,
  rz: number,
  big: boolean,
): void {
  ellipse(ctx, index, x, z, rx, rz);
  const [cx, cy] = px(index, x, z);
  const grad = ctx.createRadialGradient(cx, cy - rz * PX_Z * 0.3, 1, cx, cy, rz * PX_Z);
  grad.addColorStop(0, '#5a3822');
  grad.addColorStop(0.55, INK);
  grad.addColorStop(1, '#170d07');
  ctx.fillStyle = grad;
  ctx.fill();
  ellipse(ctx, index, x - rx * 0.32, z + rz * 0.34, rx * (big ? 0.42 : 0.34), rz * (big ? 0.3 : 0.24));
  ctx.fillStyle = '#fff8ea';
  ctx.fill();
  ellipse(ctx, index, x + rx * 0.36, z - rz * 0.3, rx * 0.17, rz * 0.12);
  ctx.fillStyle = 'rgba(255,248,234,0.85)';
  ctx.fill();
}

function blush(ctx: Ctx, index: number, alpha: number): void {
  for (const sx of [-1, 1]) {
    const [cx, cy] = px(index, sx * 4.3, 59.2);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1.5 * PX_X);
    grad.addColorStop(0, `rgba(243,156,43,${alpha})`); // saffron, no new hue (R10)
    grad.addColorStop(1, 'rgba(243,156,43,0)');
    ctx.fillStyle = grad;
    ellipse(ctx, index, sx * 4.3, 59.2, 1.6, 1.3);
    ctx.fill();
  }
}

function brows(ctx: Ctx, index: number, tilt: number, lift: number, width = 0.62): void {
  stroke(ctx, width);
  for (const sx of [-1, 1]) {
    const z0 = 65.0 + lift;
    curve(ctx, index, [sx * 1.3, z0 - tilt], [sx * 3.0, z0 + 0.65], [sx * 4.7, z0 - tilt * 0.4 + 0.1]);
    ctx.stroke();
  }
}

function smile(ctx: Ctx, index: number, width: number, depth: number, z = 56.9): void {
  stroke(ctx, 0.42);
  curve(ctx, index, [-width, z + 0.45], [0, z - depth], [width, z + 0.45]);
  ctx.stroke();
}

function drawFrame(ctx: Ctx, index: number, look: Look, set: FaceSet = 'comic'): void {
  if (set === 'restrained') {
    drawRestrained(ctx, index, look);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(index * FRAME_W, 0, FRAME_W, ATLAS_H);
  ctx.clip();
  const eyeZ = 62.5;
  switch (look) {
    case 'idle':
      glossyEye(ctx, index, -2.9, eyeZ, 1.3, 1.75, false);
      glossyEye(ctx, index, 2.9, eyeZ, 1.3, 1.75, false);
      brows(ctx, index, 0.35, 0.0);
      smile(ctx, index, 2.0, 0.85);
      blush(ctx, index, 0.3);
      break;
    case 'blink':
      stroke(ctx, 0.5);
      for (const sx of [-1, 1]) {
        curve(ctx, index, [sx * 1.6, eyeZ + 0.1], [sx * 2.9, eyeZ - 0.9], [sx * 4.2, eyeZ + 0.1]);
        ctx.stroke();
      }
      brows(ctx, index, 0.3, -0.1);
      smile(ctx, index, 2.0, 0.85);
      blush(ctx, index, 0.3);
      break;
    case 'happy':
      stroke(ctx, 0.62);
      for (const sx of [-1, 1]) {
        curve(ctx, index, [sx * 1.4, eyeZ - 0.4], [sx * 2.9, eyeZ + 1.7], [sx * 4.4, eyeZ - 0.4]);
        ctx.stroke();
      }
      brows(ctx, index, 0.05, 0.5);
      // open smile with a tongue
      ctx.fillStyle = INK;
      path(ctx, index, [
        [-2.3, 57.9],
        [2.3, 57.9],
      ]);
      curve(ctx, index, [-2.3, 57.9], [0, 54.9], [2.3, 57.9]);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, index, 0, 56.1, 1.2, 0.55);
      ctx.fillStyle = '#E4572E';
      ctx.fill();
      blush(ctx, index, 0.5);
      break;
    case 'excited':
      glossyEye(ctx, index, -2.9, eyeZ, 1.5, 2.0, true);
      glossyEye(ctx, index, 2.9, eyeZ, 1.5, 2.0, true);
      brows(ctx, index, -0.15, 0.85);
      ctx.fillStyle = INK;
      ellipse(ctx, index, 0, 56.9, 1.9, 1.3);
      ctx.fill();
      ellipse(ctx, index, 0, 56.1, 1.1, 0.55);
      ctx.fillStyle = '#E4572E';
      ctx.fill();
      blush(ctx, index, 0.55);
      ctx.fillStyle = '#fff3c4';
      for (const [x, z, s] of [
        [-4.4, 66.0, 0.5],
        [4.5, 66.3, 0.38],
      ] as const) {
        const [cx, cy] = px(index, x, z);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const r = (k % 2 === 0 ? 1 : 0.32) * s * PX_X * 2;
          const a = (Math.PI / 4) * k - Math.PI / 2;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
      break;
    case 'scared':
      for (const sx of [-1, 1]) {
        ellipse(ctx, index, sx * 2.9, eyeZ, 1.55, 2.0);
        ctx.fillStyle = '#fff8ea';
        ctx.fill();
        stroke(ctx, 0.26);
        ctx.stroke();
        ellipse(ctx, index, sx * 2.9, eyeZ - 0.2, 0.5, 0.62);
        ctx.fillStyle = INK;
        ctx.fill();
      }
      brows(ctx, index, -0.55, 0.9);
      ctx.fillStyle = INK;
      ellipse(ctx, index, 0, 56.8, 1.0, 1.35);
      ctx.fill();
      ellipse(ctx, index, 5.0, 64.0, 0.42, 0.7);
      ctx.fillStyle = '#9cd2ec';
      ctx.fill();
      break;
    case 'sad':
      for (const sx of [-1, 1]) {
        glossyEye(ctx, index, sx * 2.9, eyeZ - 0.2, 1.3, 1.55, true);
        ctx.fillStyle = '#f3c88b';
        ctx.beginPath(); // heavy lid over the top of each eye
        const [cx, cy] = px(index, sx * 2.9, eyeZ + 0.55);
        ctx.ellipse(cx, cy, 1.6 * PX_X, 1.0 * PX_Z, 0, Math.PI, 2 * Math.PI);
        ctx.fill();
      }
      stroke(ctx, 0.6);
      for (const sx of [-1, 1]) {
        curve(ctx, index, [sx * 1.3, 64.5], [sx * 3.0, 65.4], [sx * 4.6, 65.0 + 0.9]);
        ctx.stroke();
      }
      stroke(ctx, 0.42);
      curve(ctx, index, [-1.6, 56.3], [0, 57.5], [1.6, 56.3]);
      ctx.stroke();
      ellipse(ctx, index, -4.0, 60.0, 0.36, 0.7);
      ctx.fillStyle = '#9cd2ec';
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** The restrained set (Rama, Sita): the comic idle eyes, calmer brows, and only gentle mouths, per `faceSpec`. */
function drawRestrained(ctx: Ctx, index: number, look: Look): void {
  const spec = faceSpec('restrained', look);
  ctx.save();
  ctx.beginPath();
  ctx.rect(index * FRAME_W, 0, FRAME_W, ATLAS_H);
  ctx.clip();
  const eyeZ = 62.5;
  if (look === 'blink') {
    stroke(ctx, 0.5);
    for (const sx of [-1, 1]) {
      curve(ctx, index, [sx * 1.6, eyeZ + 0.1], [sx * 2.9, eyeZ - 0.9], [sx * 4.2, eyeZ + 0.1]);
      ctx.stroke();
    }
  } else if (look === 'happy') {
    stroke(ctx, 0.62);
    for (const sx of [-1, 1]) {
      curve(ctx, index, [sx * 1.4, eyeZ - 0.4], [sx * 2.9, eyeZ + 1.5], [sx * 4.4, eyeZ - 0.4]);
      ctx.stroke();
    }
  } else {
    const heavy = look === 'sad';
    for (const sx of [-1, 1]) {
      glossyEye(ctx, index, sx * 2.9, eyeZ - (heavy ? 0.2 : 0), 1.3, heavy ? 1.55 : 1.75, heavy);
      if (heavy) {
        ctx.fillStyle = '#f0c08f';
        ctx.beginPath(); // soft lid over the top of each eye, no tear
        const [cx, cy] = px(index, sx * 2.9, eyeZ + 0.5);
        ctx.ellipse(cx, cy, 1.5 * PX_X, 0.9 * PX_Z, 0, Math.PI, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  brows(ctx, index, spec.browTilt, spec.browLift);
  switch (look) {
    case 'happy':
    case 'excited':
      stroke(ctx, 0.42);
      curve(ctx, index, [-2.3, 57.4], [0, 55.9], [2.3, 57.4]); // a wider closed smile, no tongue
      ctx.stroke();
      break;
    case 'scared': // concern: a small level mouth, eyes and brows as at idle
      stroke(ctx, 0.4);
      curve(ctx, index, [-1.2, 56.6], [0, 56.4], [1.2, 56.6]);
      ctx.stroke();
      break;
    case 'sad':
      stroke(ctx, 0.42);
      curve(ctx, index, [-1.6, 56.3], [0, 57.3], [1.6, 56.3]);
      ctx.stroke();
      break;
    default:
      smile(ctx, index, 2.0, 0.85);
  }
  blush(ctx, index, look === 'excited' || look === 'happy' ? 0.45 : 0.3);
  ctx.restore();
}

export function drawFaceAtlas(ctx: Ctx, set: FaceSet = 'comic'): void {
  ctx.clearRect(0, 0, ATLAS_W, ATLAS_H);
  FACE_FRAMES.forEach((look, index) => drawFrame(ctx, index, look, set));
}

const shared: Partial<Record<FaceSet, CanvasTexture>> = {};

/** One atlas texture per face set for the page; each hero clones it (shared image) to keep its own frame offset. */
export function faceAtlasTexture(set: FaceSet = 'comic'): CanvasTexture {
  const cached = shared[set];
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');
  if (ctx) drawFaceAtlas(ctx, set);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false; // glTF UVs: v = 0 is the top of the image
  texture.anisotropy = 4;
  shared[set] = texture;
  return texture;
}

/** A hero's own texture object over the shared atlas, showing frame `index`. */
export function faceTextureFor(set: FaceSet = 'comic'): CanvasTexture {
  const t = faceAtlasTexture(set).clone();
  t.flipY = false;
  t.colorSpace = SRGBColorSpace;
  t.repeat.set(1 / FACE_FRAMES.length, 1);
  t.needsUpdate = true;
  return t;
}

export function showFrame(texture: CanvasTexture, index: number): void {
  texture.offset.x = index / FACE_FRAMES.length;
}
