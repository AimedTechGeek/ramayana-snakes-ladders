// Review captures of the 3D bridges (T44.13) from the running dev server: all nine bridges, the rise, Hanuman mid-deck,
// the fade-when-behind. Drives the board view directly (the same hooks the T44.8 review pack used).
//   npx vite --port 5185      (in another shell)
//   node scripts/bridges-shots.mjs [outDir] [baseUrl] [what: all|bridges|rise|deck|fade|metrics]
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'screenshots-tmp/t44-bridges';
const BASE = process.argv[3] ?? 'http://localhost:5185';
const WHAT = process.argv[4] ?? 'all';
await mkdir(OUT, { recursive: true });

const IDS = [
  ['vishwamitra', 4, 25],
  ['shiva-bow', 20, 43],
  ['wedding', 26, 52],
  ['guha', 49, 74],
  ['shabari', 85, 108],
  ['hanuman-meeting', 88, 113],
  ['sugriva', 92, 118],
  ['hanuman-leap', 95, 122],
  ['rama-setu', 101, 127],
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const problems = [];

async function openBoard(viewport = { width: 1280, height: 720 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  await page.goto(BASE);
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
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.waitForTimeout(2500);
  // reach the live view through the same module instance the app uses
  await page.evaluate(async () => {
    const hooks = await import('/src/app/appHooks.ts');
    window.__view = hooks.bridge.view;
    window.__view.revealAll();
  });
  return { context, page };
}

/** Frames a point of the board: azimuth 0 looks from the viewer's side. */
async function look(page, target, distance, polar = 0.75, azimuth = 0.1) {
  await page.evaluate(({ target, distance, polar, azimuth }) => window.__app.camera.set({ azimuth, polar, distance, target }), {
    target,
    distance,
    polar,
    azimuth,
  });
  await page.waitForTimeout(700);
}

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`wrote ${OUT}/${name}.png`);
}

const midpoint = async (page, id) =>
  page.evaluate(async (id) => {
    const geo = await import('/src/app/board3d/bridgeGeometry.ts');
    const b = geo.bridgeById(id);
    const m = b.deck[60];
    return { target: [m.x, m.y, m.z], length: b.length };
  }, id);

if (WHAT === 'all' || WHAT === 'bridges') {
  const { context, page } = await openBoard();
  await page.evaluate((ids) => ids.forEach(([, from]) => window.__view.jumpRise.set(from, 1)), IDS);
  await page.evaluate(() => window.__view.changed?.());
  await page.waitForTimeout(3000);
  for (const [id] of IDS) {
    const { target, length } = await midpoint(page, id);
    // shabari is a 0.27 u stub on the board edge: frame it from close, turned to face the open side
    if (id === 'shabari') await look(page, target, 2.2, 0.9, -0.7);
    else await look(page, target, Math.max(2.6, length * 1.15 + 1.2));
    await shoot(page, `bridge-${id}`);
  }
  await look(page, [0, 0, 0], 14, 0.9, 0.0);
  await shoot(page, 'overview-all-nine');
  await context.close();
}

/** Puts a token on a square (staging: no walking). */
async function place(page, player, square) {
  await page.evaluate(
    ({ player, square }) => {
      const view = window.__view;
      view.tokens[player].square = square;
      view.tokens[player].spot = view.spotOf(player);
      view.changed();
    },
    { player, square },
  );
}

if (WHAT === 'all' || WHAT === 'rise') {
  // staged frames of the rise: the view's eased rise value is held at fixed steps (a real rise is 450 ms, Fast 225)
  const { context, page } = await openBoard();
  const [id, from] = IDS[0];
  const { target, length } = await midpoint(page, id);
  await look(page, target, length * 1.15 + 1.4);
  await page.evaluate((from) => {
    window.__view.jumpRise.set(from, 0.0001);
    window.__view.changed();
  }, from);
  await page.waitForTimeout(1500);
  for (const [step, rise] of [[1, 0.12], [2, 0.3], [3, 0.55], [4, 0.8], [5, 1]]) {
    await page.evaluate(({ from, rise }) => window.__view.jumpRise.set(from, rise), { from, rise });
    await page.waitForTimeout(250);
    await shoot(page, `rise-${id}-${step}-of-5`);
  }
  await context.close();
}

if (WHAT === 'all' || WHAT === 'deck') {
  const { context, page } = await openBoard();
  for (const [id, from, to] of IDS.filter(([i]) => ['vishwamitra', 'hanuman-meeting'].includes(i))) {
    await page.evaluate((from) => window.__view.jumpRise.set(from, 1), from);
    await page.evaluate(() => window.__view.changed());
    await page.waitForTimeout(1500);
    const { target, length } = await midpoint(page, id);
    await look(page, target, length * 0.9 + 2.2, 0.8);
    await place(page, 0, from);
    await page.evaluate(
      ({ from, to }) => {
        window.__view.cross(0, { from, to, name: '' }, { fast: false, reducedMotion: false }, () => {});
      },
      { from, to },
    );
    // step-on: the first leap in flight; mid-deck: running, a third of the way along the deck
    await page.waitForFunction(() => window.__view.tokens[0].leap && window.__view.tokens[0].leap.ms > 250, null, { polling: 16 });
    await shoot(page, `cross-${id}-step-on`);
    await page.waitForFunction(() => !window.__view.tokens[0].leap && window.__view.tokens[0].override, null, { polling: 16 });
    await page.waitForTimeout(220);
    await shoot(page, `cross-${id}-mid-deck`);
    await page.waitForTimeout(2500);
  }
  await context.close();
}

if (WHAT === 'all' || WHAT === 'close') {
  const { context, page } = await openBoard();
  await page.evaluate((ids) => ids.forEach(([, from]) => window.__view.jumpRise.set(from, 1)), IDS);
  await page.evaluate(() => window.__view.changed());
  await page.waitForTimeout(2500);
  for (const [id] of IDS) {
    const { target, length } = await midpoint(page, id);
    if (id === 'shabari') await look(page, target, 1.6, 0.9, -0.7);
    else await look(page, target, Math.max(1.7, length * 0.55 + 1.2), 1.0, 0.35);
    await shoot(page, `close-${id}`);
  }
  await context.close();
}

if (WHAT === 'all' || WHAT === 'thud') {
  const { context, page } = await openBoard();
  await page.evaluate(() => window.__view.jumpRise.set(4, 1));
  await page.evaluate(() => window.__view.changed());
  await page.waitForTimeout(1500);
  const { target, length } = await midpoint(page, 'vishwamitra');
  await look(page, target, length * 1.15 + 1.4);
  await shoot(page, 'thud-0-resting');
  // hold the thud at its peak (60 ms into 120) for the capture
  await page.evaluate(() => {
    const view = window.__view;
    const real = performance.now.bind(performance);
    const origin = real();
    view.thuds.set(4, origin);
    performance.now = () => origin + 60; // frozen at the peak
  });
  await page.waitForTimeout(300);
  await shoot(page, 'thud-1-peak');
  await context.close();
}

if (WHAT === 'all' || WHAT === 'fade') {
  const { context, page } = await openBoard();
  await page.evaluate(() => window.__view.jumpRise.set(95, 1));
  await page.evaluate(() => window.__view.changed());
  await place(page, 1, 119);
  await page.waitForTimeout(1500);
  const { target } = await midpoint(page, 'hanuman-leap');
  await look(page, target, 4.2, 0.8);
  await shoot(page, 'fade-behind-token-on-119');
  await place(page, 1, 0);
  await page.waitForTimeout(600);
  await shoot(page, 'fade-behind-token-gone');
  await context.close();
}

if (WHAT === 'all' || WHAT === 'metrics') {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const { context, page } = await openBoard(viewport);
    await page.evaluate(() => window.__app.camera.fit());
    await page.waitForTimeout(1500);
    const base = await page.evaluate(() => window.__app.metrics());
    await page.evaluate((ids) => ids.forEach(([, from]) => window.__view.jumpRise.set(from, 1)), IDS);
    await page.evaluate(() => window.__view.changed());
    await page.waitForTimeout(2500);
    const all = await page.evaluate(() => window.__app.metrics());
    console.log(name, 'baseline (fog lifted, no bridges)', JSON.stringify(base));
    console.log(name, 'nine bridges standing', JSON.stringify(all));
    console.log(name, 'bridges add: draw calls', all.drawCalls - base.drawCalls, 'shadow casters', all.shadowCalls - base.shadowCalls, 'triangles', all.triangles - base.triangles);
    await context.close();
  }
}

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no page errors');
await browser.close();
