// Headless msedge driver for the snake preview page (snake.html): the turntable sheet of every snake and a clip strip.
//   node scripts/blender/snake-check.mjs <outDir> [baseUrl] [sheet|turn|clips|all] [id ...]
// Needs the dev server:  npx vite --port 5184
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const outDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5184';
const what = process.argv[4] ?? 'all';
const only = process.argv.slice(5);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 420, height: 460 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/snake.html`);
await page.waitForFunction(() => window.__snake?.ready, null, { timeout: 30000 });
const ids = await page.evaluate(() => window.__snake.ids);
const list = only.length ? only : ids;

async function show(id) {
  await page.evaluate((i) => window.__snake.setSnake(i), id);
  await page.waitForFunction(() => window.__snake.stats().triangles > 0, null, { timeout: 30000 });
  await page.waitForTimeout(150);
}

async function sheet(files, cols, name, cell) {
  const urls = await Promise.all(files.map(async (f) => `data:image/png;base64,${(await readFile(f)).toString('base64')}`));
  const rows = Math.ceil(urls.length / cols);
  const p = await browser.newPage({ viewport: { width: cell.w * cols, height: cell.h * rows } });
  await p.setContent(
    `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${cell.w}px);background:#7e88bc">${urls
      .map((u) => `<img src="${u}" width="${cell.w}" height="${cell.h}">`)
      .join('')}</body>`,
  );
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${outDir}/${name}.png` });
  await p.close();
}

const cam = (az, el = 34, dist = 2.0, target = [0, 0.26, -0.2]) =>
  page.evaluate((c) => window.__snake.setCamera(c), { az, el, dist, target });

if (what === 'sheet' || what === 'all') {
  const files = [];
  for (const id of list) {
    await show(id);
    await cam(18);
    await page.evaluate(() => window.__snake.pose('idle', 0));
    await page.waitForTimeout(120);
    const f = `${outDir}/front-${id}.png`;
    await page.screenshot({ path: f });
    files.push(f);
  }
  await sheet(files, 5, 'sheet-front', { w: 420, h: 460 });
}
if (what === 'turn' || what === 'all') {
  for (const id of list) {
    await show(id);
    const files = [];
    for (const [az, clip, u] of [[0, 'idle', 0], [60, 'idle', 0], [120, 'idle', 0], [180, 'idle', 0], [-60, 'idle', 0], [0, 'strike', 1]]) {
      await cam(az, 24);
      await page.evaluate(([c, k]) => window.__snake.pose(c, k), [clip, u]);
      await page.waitForTimeout(120);
      const f = `${outDir}/turn-${id}-${az}-${clip}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
    await sheet(files, 3, `turntable-${id}`, { w: 420, h: 460 });
  }
}
if (what === 'clips' || what === 'all') {
  for (const id of list.slice(0, only.length ? 99 : 3)) {
    await show(id);
    await cam(15, 24, 2.6, [0, 0.3, -0.12]);
    const files = [];
    const steps = [['rise', 0.25], ['rise', 0.55], ['rise', 1], ['hold', 1], ['strike', 0.5], ['strike', 1], ['swallow', 0.4], ['swallow', 0.75], ['swallow', 1], ['settle', 0.5], ['settle', 1]];
    for (const [i, [clip, u]] of steps.entries()) {
      await page.evaluate(([c, k]) => window.__snake.pose(c, k), [clip, u]);
      await page.waitForTimeout(100);
      const f = `${outDir}/clip-${id}-${i}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
    await sheet(files, 4, `clips-${id}`, { w: 420, h: 460 });
  }
}
const stats = await page.evaluate(() => window.__snake.stats());
console.log(JSON.stringify({ stats, errors }));
await browser.close();
