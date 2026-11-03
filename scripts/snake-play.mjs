// In-game bite sequence for review (T44.12, T45.4): forces the dice so Hanuman lands on Manthara's head (37) and
// photographs the whole scene from the Bitten event on, at full frame, with each frame's time since the bite began.
//   node scripts/snake-play.mjs <outDir> [baseUrl] [normal|fast|reduced|classic]   (needs the dev server: npx vite --port 5184)
// `classic` turns "Bite close-ups" off through the Menu first; `reduced` opens the page with prefers-reduced-motion.
// It writes seq-<n>-<ms>.png for every frame and moment-<k>-<ms>.png for the frames nearest the review moments; lay
// the moments out with ~/.claude/skills/web-visual-check/scripts/sheet.mjs.
import { copyFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const outDir = process.argv[2] ?? 'screenshots-tmp/t45-bite';
const base = process.argv[3] ?? 'http://localhost:5184';
const mode = process.argv[4] ?? 'normal';
/** Seconds after the Bitten event at which the review wants a frame (the T45.4 beat table, plus the restore). */
const MOMENTS =
  mode === 'fast' || mode === 'classic'
    ? [0.1, 0.4, 0.7, 1.0, 1.3, 1.7, 2.0, 2.4]
    : [0.35, 1.0, 1.35, 1.65, 1.95, 2.5, 3.0, 3.35, 3.75, 4.3];
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference',
});
const page = await context.newPage();
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
});
if (mode === 'classic') {
  // the Menu's "Bite close-ups" toggle, off
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid=menu-dialog]');
  await page.click('[data-testid=menu-close-ups]');
  await page.screenshot({ path: `${outDir}/menu-close-ups-off.png` });
  await page.click('[data-testid=continue]');
  await page.waitForSelector('[data-testid=menu-dialog]', { state: 'detached' });
}
await page.evaluate(() => window.__app.setFast(true)); // reach the snake quickly
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
}
let turn = await page.evaluate(() => window.__app.state().game.current);
while (turn === 1) {
  await rollFor(1);
  turn = await page.evaluate(() => window.__app.state().game.current);
}
await page.evaluate((on) => window.__app.setFast(on), mode === 'fast');
// the player's view: Fit (what the restore must bring back)
await page.evaluate(() => window.__app.camera.fit());
await page.waitForTimeout(1200);
const before = await page.evaluate(() => window.__app.camera.get());
const at = await pos(0);
console.log('hanuman at', at, 'rolling', 37 - at, 'mode', mode);
await page.evaluate((v) => window.__queue.push(v), 37 - at);
await page.evaluate(() => void window.__app.requestRoll());
// frames: as fast as the screenshots come, each stamped with its time since the Bitten event began
const frames = [];
let t0 = -1;
const wall = Date.now();
while (Date.now() - wall < 20000) {
  const state = await page.evaluate(() => ({ busy: window.__app.isBusy, last: window.__app.state().lastEvent?.type }));
  if (t0 < 0 && state.last === 'Bitten') t0 = Date.now();
  if (t0 >= 0) {
    const ms = Date.now() - t0;
    const file = `${outDir}/seq-${String(frames.length).padStart(2, '0')}-${String(ms).padStart(4, '0')}.png`;
    await page.screenshot({ path: file });
    frames.push({ ms, file });
    if (!state.busy) break;
  } else await page.waitForTimeout(30);
}
const after = await page.evaluate(() => window.__app.camera.get());
const dist = (a, b) =>
  Math.hypot(
    a.azimuth - b.azimuth,
    a.polar - b.polar,
    (a.distance - b.distance) / 10,
    ...a.target.map((v, i) => v - b.target[i]),
  );
console.log('frames', frames.length, 'scene ms', frames.at(-1)?.ms, 'now at', await pos(0));
console.log(
  'camera before',
  JSON.stringify(before),
  'after',
  JSON.stringify(after),
  'restore error',
  dist(before, after).toFixed(3),
);
// the review moments: the nearest frame to each
let k = 0;
for (const moment of MOMENTS) {
  const target = moment * 1000;
  const nearest = frames.reduce(
    (best, f) => (Math.abs(f.ms - target) < Math.abs(best.ms - target) ? f : best),
    frames[0],
  );
  if (!nearest) break;
  const name = `${outDir}/moment-${String(++k).padStart(2, '0')}-${String(nearest.ms).padStart(4, '0')}ms.png`;
  await copyFile(nearest.file, name);
  console.log('moment', moment, '->', nearest.ms, 'ms');
}
console.log('problems', JSON.stringify(problems));
await browser.close();
