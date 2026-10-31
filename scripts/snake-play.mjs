// In-game bite sequence for the snake review (T44.12): forces the dice so Hanuman lands on Manthara's head (37) and
// photographs the board while land -> rise -> hold -> strike -> swallow -> reappear plays.
//   node scripts/snake-play.mjs <outDir> [baseUrl] [fast]      (needs the dev server: npx vite --port 5184)
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const outDir = process.argv[2] ?? 'screenshots-tmp/t44-snakes/game';
const base = process.argv[3] ?? 'http://localhost:5184';
const fast = process.argv[4] === 'fast';
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !m.location().url.endsWith('favicon.ico') && problems.push(m.text()));
await page.goto(base);
await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 30000 });
await page.evaluate(() =>
  window.__app.startGame({
    level: 'easy',
    playOn: false,
    players: [
      { hero: 'hanuman', controller: 'human', name: 'Hanuman' },
      { hero: 'rama', controller: 'human', name: 'Rama' },
    ],
  }),
);
// dice come from crypto.getRandomValues: feed a queue when it has something
await page.evaluate(() => {
  window.__queue = [];
  const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (buf) => {
    if (window.__queue.length && buf instanceof Uint32Array && buf.length === 1) {
      buf[0] = window.__queue.shift() - 1 + 6 * 1000;
      return buf;
    }
    return real(buf);
  };
  window.__app.setFast(false);
});
if (fast) await page.evaluate(() => window.__app.setFast(true));
const settle = () => page.waitForFunction(() => !window.__app.isBusy, null, { timeout: 60000 });
const rollFor = async (value) => {
  await page.evaluate((v) => window.__queue.push(v), value);
  await page.evaluate(() => window.__app.requestRoll());
  await settle();
};
const pos = (i) => page.evaluate((k) => window.__app.state().game.players[k].position, i);
// Hanuman: 3, 5 x5, 4 lands on 32 (steps over the ladder heads 4 and 26); Rama just rolls ones
const plan = [3, 5, 5, 5, 5, 5, 4];
for (const value of plan) {
  while ((await page.evaluate(() => window.__app.state().game.current)) === 1) await rollFor(1);
  await rollFor(value);
  console.log('after', value, await pos(0));
}
let at;
let turn = await page.evaluate(() => window.__app.state().game.current);
while (turn === 1) {
  await rollFor(1);
  turn = await page.evaluate(() => window.__app.state().game.current);
}
await page.evaluate(() => window.__app.camera.set({ azimuth: 0.25, polar: 0.95, distance: 4.6, target: [4.6, 0.2, 2.6] }));
await page.waitForTimeout(900);
at = await pos(0);
console.log('hanuman at', at, 'rolling', 37 - at);
await page.evaluate((v) => window.__queue.push(v), 37 - at);
await page.evaluate(() => void window.__app.requestRoll());
const t0 = Date.now();
let n = 0;
while (n < 60) {
  const busy = await page.evaluate(() => window.__app.isBusy);
  if (!busy && n > 2) break;
  await page.screenshot({ path: `${outDir}/seq-${String(n).padStart(2, '0')}.png`, clip: { x: 280, y: 80, width: 1000, height: 600 } });
  n++;
}
console.log('frames', n, 'ms', Date.now() - t0, 'now at', await pos(0), 'problems', JSON.stringify(problems));
await page.evaluate(() => window.__app.camera.set({ azimuth: 0.25, polar: 0.95, distance: 4.6, target: [-0.5, 0.2, 4.2] }));
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/tail-after.png` });
await page.evaluate(() => window.__app.camera.set({ azimuth: 0.25, polar: 0.95, distance: 3.2, target: [5.2, 0.3, 2.2] }));
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/head-after.png` });
console.log('metrics (snake 37 in view)', JSON.stringify(await page.evaluate(() => window.__app.metrics())));
// contact sheet: up to 20 evenly spaced frames
const { readFile } = await import('node:fs/promises');
const count = Math.min(20, n);
const picks = Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / Math.max(1, count - 1)));
const urls = await Promise.all(picks.map(async (k) => 'data:image/png;base64,' + (await readFile(outDir + '/seq-' + String(k).padStart(2, '0') + '.png')).toString('base64')));
const sheetPage = await browser.newPage({ viewport: { width: 380 * 5, height: 260 * Math.ceil(urls.length / 5) } });
await sheetPage.setContent('<body style="margin:0;display:grid;grid-template-columns:repeat(5,380px)">' + urls.map((u) => '<img src="' + u + '" width="380" height="260">').join('') + '</body>');
await sheetPage.waitForTimeout(300);
await sheetPage.screenshot({ path: outDir + '/sequence-sheet.png' });
await browser.close();
