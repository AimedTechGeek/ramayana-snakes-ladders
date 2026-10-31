// node scripts/art/iso/snakes/sheet.mjs [--dir=public/assets/iso] [--level=hard] [--scale=2] [--out=file.png] [--only=id,id]
//   [--bg=rrggbb] [--clip=x,y,w,h in screenshot px]
// Review sheet of the BUILT atlas (not of the build intermediates): every snake as it will be drawn at runtime, the head
// sprite placed on its pivot over the coil sprite, closed and open, on the tile colour of its region. `--scale` is device
// px of the screenshot per atlas px (2 = a 2x contact sheet, 4 = a close-up).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const dir = arg('dir', 'public/assets/iso');
const level = arg('level', 'hard');
const scale = Number(arg('scale', '2'));
const out = arg('out', `snakes-${level}-${scale}x.png`);
const only = arg('only')?.split(',');
const bgOverride = arg('bg') && `#${arg('bg')}`;
const clip = arg('clip')?.split(',').map(Number);

// Tile colours of the region of each head square (spec section 2).
const GROUND = {
  tataka: '#9CC46B',
  manthara: '#E3C98D',
  kaikeyi: '#E3C98D',
  viradha: '#4F7F3C',
  shurpanakha: '#4F7F3C',
  'golden-deer': '#4F7F3C',
  abduction: '#4F7F3C',
  kabandha: '#4F7F3C',
  'indrajit-arrows': '#3F8FB5',
  prahasta: '#3F8FB5',
  kumbhakarna: '#2A2E6B',
  brahmastra: '#2A2E6B',
  ravana: '#2A2E6B',
};

const meta = JSON.parse(readFileSync(join(dir, `snakes-${level}.meta.json`), 'utf8'));
const atlas = JSON.parse(readFileSync(join(dir, `snakes-${level}.json`), 'utf8'));
const png = readFileSync(join(dir, `snakes-${level}.png`)).toString('base64');
const ids = Object.keys(meta.snakes).filter((id) => !only || only.includes(id));

const sprite = (frameName, left, top) => {
  const { x, y, w, h } = atlas.frames[frameName].frame;
  const z = scale;
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${w * z}px;height:${h * z}px;background:url(data:image/png;base64,${png}) -${x * z}px -${y * z}px / ${atlas.meta.size.w * z}px ${atlas.meta.size.h * z}px no-repeat"></div>`;
};

const CELL = { w: 200 * scale, h: 190 * scale };
const cells = [];
ids.forEach((id, index) => {
  const s = meta.snakes[id];
  const coil = meta.frames[s.coil.frame];
  const headClosed = meta.frames[s.head.closed];
  [['closed', s.head.closed], ['open', s.head.open]].forEach(([state, headName], column) => {
    const cx = (column * CELL.w) + CELL.w / 2;
    const cy = index * CELL.h + CELL.h * 0.78;
    const gx = cx - coil.anchorX * scale;
    const gy = cy - coil.anchorY * scale;
    const hx = cx + s.head.pivot[0] * scale - headClosed.anchorX * scale;
    const hy = cy + s.head.pivot[1] * scale - headClosed.anchorY * scale;
    const bg = `<div style="position:absolute;left:${column * CELL.w}px;top:${index * CELL.h}px;width:${CELL.w}px;height:${CELL.h}px;background:${bgOverride ?? GROUND[id] ?? '#cccccc'}"></div>`;
    const label = `<div style="position:absolute;left:${column * CELL.w + 4}px;top:${index * CELL.h + 2}px;font:${10 * scale / 2}px monospace;color:#000a">${id} ${state}</div>`;
    cells.push(bg, label, sprite(s.coil.frame, gx, gy), sprite(headName, hx, hy));
  });
});

const width = 2 * CELL.w;
const height = ids.length * CELL.h;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(`<!doctype html><body style="margin:0;background:#888;position:relative;width:${width}px;height:${height}px;overflow:hidden">${cells.join('')}</body>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out, clip: clip ? { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } : { x: 0, y: 0, width, height } });
} finally {
  await browser.close();
}
console.log(`wrote ${out} ${width}x${height}`);
