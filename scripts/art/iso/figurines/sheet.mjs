// Contact sheet and walk-strip check of the Hanuman sheet (T43.1 review). Reads public/assets/iso/hanuman-s.{png,json,meta.json}.
//   node sheet.mjs <out dir> [zoom]
// writes <out>/clips.png   all 61 frames at `zoom` x logical px (default 2), grouped by facing and clip
//        <out>/strips.png  each walk / run cycle (two cycles) placed at its anchors along a straight line at the cycle's
//                          stride; a red mark on every planted foot: the marks of one stance must stack on one spot
// and prints the largest planted-foot drift (px at zoom 2) over every held stance.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRasteriser } from '../atlas.mjs';

const out = process.argv[2] ?? 'art-src/iso/review';
const zoom = Number(process.argv[3] ?? 2);
const dir = fileURLToPath(new URL('../../../../public/assets/iso/', import.meta.url));
const png = `data:image/png;base64,${readFileSync(join(dir, 'hanuman-s.png')).toString('base64')}`;
const atlas = JSON.parse(readFileSync(join(dir, 'hanuman-s.json'), 'utf8')).frames;
const meta = JSON.parse(readFileSync(join(dir, 'hanuman-s.meta.json'), 'utf8')).frames;
const clips = JSON.parse(readFileSync(join(dir, 'hanuman-s.clips.json'), 'utf8')).clips;
const camera = JSON.parse(
  readFileSync(new URL('../../../../src/game/iso/camera.json', import.meta.url), 'utf8'),
);

const FACTOR = 4;
const K = 0.7621;
const DEG = Math.PI / 180;
const AXES = { SE: [1, 0], SW: [0, 1], NW: [-1, 0], NE: [0, -1] };
const sheetSize = JSON.parse(readFileSync(join(dir, 'hanuman-s.json'), 'utf8')).meta.size;

/** Screen px (logical) of a world offset in the board camera. */
function screenOf(x, y, z) {
  const a = camera.azimuth * DEG;
  const e = camera.elevation * DEG;
  return [
    (x * Math.sin(a) - y * Math.cos(a)) * K,
    ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * K,
  ];
}

const scale = zoom / FACTOR; // device px of the sheet to CSS px
/** A frame as a div whose top-left sits at (left, top) CSS px. */
function frameDiv(name, left, top, extra = '') {
  const { frame } = atlas[name];
  return `<div class="s" title="${name}" style="position:absolute;left:${left}px;top:${top}px;width:${frame.w * scale}px;height:${frame.h * scale}px;background-position:-${frame.x * scale}px -${frame.y * scale}px;background-size:${sheetSize.w * scale}px ${sheetSize.h * scale}px;${extra}"></div>`;
}

const names = Object.keys(meta);
const groups = [['SW', ['idle', 'happy', 'excited', 'scared', 'sad']]];
for (const facing of ['SE', 'NW', 'NE']) groups.push([facing, ['walk', 'run', 'leap']]);

function contact() {
  const cellW = Math.max(...names.map((n) => atlas[n].frame.w)) * scale + 8;
  const cellH = Math.max(...names.map((n) => atlas[n].frame.h)) * scale + 18;
  let html = '';
  let y = 0;
  let width = 0;
  for (const [facing, kinds] of groups) {
    for (const kind of kinds) {
      const row = names
        .filter((n) => meta[n].facing === facing && (meta[n].clip === kind || n === `SW.${kind}`))
        .sort((a, b) => meta[a].index - meta[b].index);
      row.forEach((n, i) => {
        const frame = atlas[n].frame;
        const left = i * cellW + 4;
        html += `<div style="position:absolute;left:${left}px;top:${y}px;font:10px sans-serif;color:#555">${n}</div>`;
        html += frameDiv(n, left, y + 14);
        // anchor mark (root ground point)
        const ax = left + meta[n].anchorX * scale;
        const ay = y + 14 + meta[n].anchorY * scale;
        html += `<div style="position:absolute;left:${ax - 2}px;top:${ay - 2}px;width:4px;height:4px;border-radius:2px;background:#2a6fdb"></div>`;
        void frame;
      });
      width = Math.max(width, row.length * cellW + 8);
      y += cellH;
    }
  }
  return { html, width: Math.ceil(width), height: Math.ceil(y) };
}

/** Planted-foot drift (px at zoom 2) between consecutive held frames of walk and run. */
function drift() {
  let worst = 0;
  let worstAt = '';
  for (const clip of ['walk', 'run']) {
    const { cycle, frames: n } = clips[clip];
    const perFrame = cycle / n;
    for (const facing of ['SE', 'NW', 'NE']) {
      const [tx, ty] = AXES[facing];
      const [rx, ry] = screenOf(tx * perFrame, ty * perFrame, 0);
      for (let i = 0; i < n; i += 1) {
        const a = meta[`${clip}.${facing}.${i}`];
        const b = meta[`${clip}.${facing}.${(i + 1) % n}`];
        if (!a.plantedPx || !b.plantedPx || a.planted.foot !== b.planted.foot) continue;
        const dx = rx + (b.plantedPx.x - b.anchorX - (a.plantedPx.x - a.anchorX)) / FACTOR;
        const dy = ry + (b.plantedPx.y - b.anchorY - (a.plantedPx.y - a.anchorY)) / FACTOR;
        const d = Math.hypot(dx, dy) * 2;
        if (d > worst) [worst, worstAt] = [d, `${clip}.${facing}.${i}`];
      }
    }
  }
  return { worst, worstAt };
}

function strips() {
  let html = '';
  let y = 0;
  let width = 0;
  const h = Math.max(...names.map((n) => atlas[n].frame.h)) * scale + 20;
  for (const clip of ['walk', 'run']) {
    const { cycle, frames: n } = clips[clip];
    const perFrame = cycle / n;
    for (const facing of ['SE', 'NW', 'NE']) {
      const [tx, ty] = AXES[facing];
      const [rx, ry] = screenOf(tx * perFrame, ty * perFrame, 0);
      const frames = 2 * n;
      // the root path runs from the left; keep it inside the strip whatever the facing
      const x0 = (rx < 0 ? frames * -rx : 0) * zoom + 130 * scale;
      const y0 = (ry < 0 ? frames * -ry : 0) * zoom + 190 * scale;
      html += `<div style="position:absolute;left:4px;top:${y}px;font:11px sans-serif">${clip} ${facing}: ${frames} frames, stride ${perFrame.toFixed(2)} units/frame</div>`;
      let marks = '';
      for (let i = 0; i < frames; i += 1) {
        const name = `${clip}.${facing}.${i % n}`;
        const m = meta[name];
        const ax = x0 + i * rx * zoom;
        const ay = y + 16 + y0 + i * ry * zoom;
        html += frameDiv(name, ax - m.anchorX * scale, ay - m.anchorY * scale, 'opacity:.55');
        if (m.plantedPx) {
          const fx = ax + (m.plantedPx.x - m.anchorX) * scale;
          const fy = ay + (m.plantedPx.y - m.anchorY) * scale;
          marks += `<div style="position:absolute;left:${fx - 1.5}px;top:${fy - 1.5}px;width:3px;height:3px;border-radius:2px;background:#e00020"></div>`;
        }
        width = Math.max(width, ax + 140 * scale);
      }
      html += marks;
      y += h + Math.abs(ry) * frames * zoom + 40;
    }
  }
  return { html, width: Math.ceil(width) + 20, height: Math.ceil(y) };
}

mkdirSync(out, { recursive: true });
const rasteriser = await openRasteriser();
try {
  for (const [file, layout] of [
    ['clips.png', contact()],
    ['strips.png', strips()],
  ]) {
    await rasteriser.page.setViewportSize({ width: layout.width, height: layout.height });
    await rasteriser.page.setContent(
      `<!doctype html><style>.s{background-image:url(${png});background-repeat:no-repeat}</style><body style="margin:0;background:#f4f1ea">${layout.html}</body>`,
    );
    await rasteriser.page.waitForTimeout(500);
    await rasteriser.page.screenshot({ path: join(out, file) });
    console.log(`wrote ${join(out, file)} ${layout.width}x${layout.height}`);
  }
} finally {
  await rasteriser.close();
}
const { worst, worstAt } = drift();
console.log(
  `largest planted-foot drift over a held stance: ${worst.toFixed(3)} px at zoom 2 (${worstAt || 'none'})`,
);
