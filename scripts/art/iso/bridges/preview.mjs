// node bridges/preview.mjs <sheet dir> <level> <screenshot dir> [crops.json]: assembles one level's bridges from the
// shipped atlas (png + json + meta) on a plain grid of the 144 squares and screenshots it (msedge headless): the full
// 784x720 view at DPR 2 and close-ups (default 4x) from crops.json: [{ name, x, y, w, h, scale? }] in logical px (board camera coordinates).
// Sprites are placed exactly as the runtime will: anchor on toScreen(world), depth = depthKey, drawn in depth order.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { squareWorld, toScreen } from '../../iso-board.mjs';
import { TOP_Z } from '../world.mjs';

const [sheetDir, level, shotDir, cropsFile] = process.argv.slice(2);
mkdirSync(shotDir, { recursive: true });
const meta = JSON.parse(readFileSync(join(sheetDir, `bridges-${level}.meta.json`), 'utf8'));
const atlas = JSON.parse(readFileSync(join(sheetDir, `bridges-${level}.json`), 'utf8'));
const png = `data:image/png;base64,${readFileSync(join(sheetDir, `bridges-${level}.png`)).toString('base64')}`;
let crops = cropsFile && cropsFile !== 'auto' ? JSON.parse(readFileSync(cropsFile, 'utf8')) : [];

const tiles = [];
for (let square = 1; square <= 144; square++) {
  const [cx, cy] = squareWorld(square);
  const corners = [
    [-27, -27],
    [27, -27],
    [27, 27],
    [-27, 27],
  ].map(([dx, dy]) => toScreen([cx + dx, cy + dy, TOP_Z]));
  const c = toScreen([cx, cy + 20, TOP_Z]);
  const odd = (Math.floor((square - 1) / 12) + ((square - 1) % 12)) % 2;
  tiles.push(
    `<polygon points="${corners.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" fill="${odd ? '#C9D8A8' : '#D6E2B8'}" stroke="#9AAE78" stroke-width=".4"/>` +
      `<text x="${c.x.toFixed(2)}" y="${(c.y + 2).toFixed(2)}" font-size="4" text-anchor="middle" fill="#6B7A52">${square}</text>`,
  );
}
const frames = Object.entries(meta.frames).map(([name, f]) => ({
  name,
  ...f,
  rect: atlas.frames[name].frame,
}));
const sprites = frames
  .sort((a, b) => (b.depthKey - a.depthKey === 0 ? 0 : a.depthKey - b.depthKey))
  .map((f) => {
    const p = toScreen([f.world[0], f.world[1], TOP_Z]);
    const x = p.x - f.anchorX / f.factor;
    const y = p.y - f.anchorY / f.factor;
    return `<div class="sprite" data-name="${f.name}" style="left:${x}px;top:${y}px;width:${f.w / f.factor}px;height:${f.h / f.factor}px;background-position:${-f.rect.x / f.factor}px ${-f.rect.y / f.factor}px"></div>`;
  });
const html = `<!doctype html><html><body style="margin:0;background:#EFE6D3"><div style="position:relative;width:784px;height:720px">
<svg width="784" height="720" style="position:absolute;left:0;top:0">${tiles.join('')}</svg>${sprites.join('')}</div>
<style>.sprite{position:absolute;background-image:url(${png});background-size:${meta.width / 4}px ${meta.height / 4}px;background-repeat:no-repeat}</style></body></html>`;

if (cropsFile === 'auto') {
  // One 4x crop per bridge: the union of its segment sprites.
  const boxes = {};
  for (const f of frames) {
    const p = toScreen([f.world[0], f.world[1], TOP_Z]);
    const x = p.x - f.anchorX / f.factor;
    const y = p.y - f.anchorY / f.factor;
    const b = (boxes[f.bridge] ??= [Infinity, Infinity, -Infinity, -Infinity]);
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x + f.w / f.factor);
    b[3] = Math.max(b[3], y + f.h / f.factor);
  }
  crops = Object.entries(boxes).map(([name, b]) => ({
    name,
    x: Math.floor(b[0]) - 4,
    y: Math.floor(b[1]) - 4,
    w: Math.ceil(b[2] - b[0]) + 8,
    h: Math.ceil(b[3] - b[1]) + 8,
  }));
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const full = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 784, height: 720 } });
  const page = await full.newPage();
  await page.setContent(html);
  await page.screenshot({ path: join(shotDir, `${level}-full.png`) });
  await full.close();
  for (const crop of crops) {
    const close = await browser.newContext({
      deviceScaleFactor: crop.scale ?? 4,
      viewport: { width: 784, height: 720 },
    });
    const view = await close.newPage();
    await view.setContent(html);
    await view.screenshot({
      path: join(shotDir, `${level}-${crop.name}.png`),
      clip: { x: crop.x, y: crop.y, width: crop.w, height: crop.h },
    });
    await close.close();
  }
} finally {
  await browser.close();
}
console.log(`screenshots in ${shotDir}`);
