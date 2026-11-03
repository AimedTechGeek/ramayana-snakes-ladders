// Screenshots for the README, the player guide and docs/ARCHITECTURE.md: serves the build on its own port, drives
// Edge through `window.__app` with queued dice (scripts/review/lib.mjs), so every scene is the same on every run (only
// the speech-bubble lines differ: the heroes pick them with Math.random), and writes WebP images to docs/images/ (PNG frames stay in screenshots-tmp/docs-shots). Run `npm run build` first.
//   npm run screenshots                  every scene
//   node scripts/screenshots.mjs win     only the named scenes (comma-separated)
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import {
  DESKTOP,
  PHONE,
  PLAYERS,
  installDice,
  launch,
  look,
  positions,
  roll,
  settle,
  shot,
  squareCentre,
  startGame,
  toWebp,
} from './review/lib.mjs';

const PORT = 4176;
const URL = `http://localhost:${PORT}`;
const OUT = 'docs/images';
const FRAMES = 'screenshots-tmp/docs-shots';
const PORTRAIT = { width: 390, height: 844 };
const SERVER_TIMEOUT_MS = 30_000;
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;

/** Easy's snake heads and ladder feet: a hero walking to a target steps round them. */
const EASY_SNAKES = new Set([37, 46, 64, 70, 76, 114]);
const EASY_LADDERS = new Set([4, 20, 26, 49, 85, 88, 92, 95, 101]);
const EASY_JUMPS = new Set([...EASY_SNAKES, ...EASY_LADDERS]);

function startServer() {
  return spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' });
}

function stopServer(server) {
  if (server.exitCode !== null) return;
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server.kill('SIGTERM');
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no server at ${URL}`);
}

/** A server already answering on the port would be shot instead of this build, so refuse to run. */
async function assertPortFree() {
  try {
    await fetch(URL);
  } catch {
    return;
  }
  throw new Error(`${URL} is already serving (a stale vite preview?). Stop it and rerun.`);
}

/**
 * A fresh browser context (empty localStorage: no autosave, English) on the app, with queued dice installed.
 * Console and page errors, and any request that leaves localhost, are collected into `problems`.
 */
async function open(browser, { viewport = DESKTOP, touch = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico'))
      problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => {
    if (!/^(https?:\/\/localhost[:/]|data:|blob:)/.test(r.url()))
      problems.push(`external request: ${r.url()}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 30_000 });
  await installDice(page);
  return { context, page, problems };
}

/** Waits for the frame to settle, then saves a PNG frame. */
async function snap(page, name, waitMs = 1000) {
  await page.waitForTimeout(waitMs);
  await shot(page, FRAMES, name);
}

const current = (page) => page.evaluate(() => window.__app.state().game.current);

/** Plays queued rolls per seat (whoever is up takes the next of its list, or a 1) until every list is empty. */
async function playPlans(page, plans) {
  while (Object.values(plans).some((plan) => plan.length > 0)) {
    const who = await current(page);
    await roll(page, plans[who]?.shift() ?? 1);
  }
}

/** The largest step of 1-5 from `at` that stays short of `limit` and off every square in `avoid` (1 if none). */
function stepFrom(at, limit, avoid) {
  for (let step = 5; step > 1; step--) if (at + step <= limit && !avoid.has(at + step)) return step;
  return 1;
}

/**
 * Plays turns in Fast until `seat` stands 1-5 squares short of `target`, never landing on a square in `avoid`; the
 * other seats shuffle on clear of every jump. Returns the roll that then lands on `target`.
 */
async function walkTo(page, seat, target, avoid = EASY_JUMPS) {
  await page.evaluate(() => window.__app.setFast(true));
  for (;;) {
    const who = await current(page);
    const at = (await positions(page))[who];
    if (who !== seat) {
      let step = 1;
      while (step < 5 && EASY_JUMPS.has(at + step)) step++;
      await roll(page, step);
      continue;
    }
    if (target - at >= 1 && target - at <= 5) break;
    await roll(page, stepFrom(at, target - 1, avoid));
  }
  await page.evaluate(() => window.__app.setFast(false));
  return target - (await positions(page))[seat];
}

/** Rolls `value` for whoever is up and shoots `delayMs` after the engine event `type` (Bitten, Laddered) begins. */
async function snapMoment(page, value, type, delayMs, name) {
  await page.evaluate((v) => window.__queue.push(v), value);
  await page.evaluate(() => void window.__app.requestRoll());
  await page.waitForFunction((t) => window.__app.state().lastEvent?.type === t, type, { timeout: 30_000 });
  await snap(page, name, delayMs);
  await settle(page);
}

const SCENES = {
  async title(browser) {
    const { context, page, problems } = await open(browser);
    await snap(page, '01-title', 3000); // the live board vignette loads its models
    await context.close();
    return problems;
  },

  async setup(browser) {
    const { context, page, problems } = await open(browser);
    await page.click('[data-testid=play]');
    await snap(page, '02-setup');
    await context.close();
    return problems;
  },

  /** Easy, four humans, four rounds of fixed rolls (Hanuman climbs 4 -> 25, Rama 20 -> 43): Fit, then the fog. */
  async board(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy', fast: true });
    await playPlans(page, { 0: [4, 5, 3, 1], 1: [5, 5, 5, 5], 2: [2, 5, 5, 3], 3: [1, 5, 3, 5] });
    await page.evaluate(() => window.__app.setFast(false));
    await page.evaluate(() => window.__app.camera.fit());
    await snap(page, '03-board', 2500);
    const front = Math.max(...(await positions(page)));
    const [x, z] = squareCentre(Math.min(front + 12, 144));
    await look(page, { azimuth: 0.25, polar: 0.95, distance: 10, target: [x, 0.4, z + 1.5] });
    await snap(page, '08-fog');
    await context.close();
    return problems;
  },

  /** Four humans walk to 8, 9, 7 and 6, then the camera comes close. */
  async heroes(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy', fast: true });
    await playPlans(page, { 0: [3, 5], 1: [5, 4], 2: [2, 5], 3: [1, 5] });
    await page.evaluate(() => window.__app.setFast(false));
    const [x, z] = squareCentre(7);
    await look(page, { azimuth: 0.3, polar: 1.12, distance: 5.2, target: [x + 0.5, 0.9, z] }, 1500);
    await snap(page, '04-heroes');
    await context.close();
    return problems;
  },

  /** Rama walks to Manthara (37 -> 19) and is bitten. */
  async bite(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy' });
    const value = await walkTo(page, 1, 37);
    const [x, z] = squareCentre(37);
    await look(page, { azimuth: -0.6, polar: 1.15, distance: 6, target: [x, 1.0, z] });
    await snapMoment(page, value, 'Bitten', 800, '05-snake-bite'); // the coil round his feet, its head up
    await context.close();
    return problems;
  },

  /** Rama crosses the wedding bridge (26 -> 52). */
  async bridge(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy' });
    const value = await walkTo(page, 1, 26);
    const [x, z] = squareCentre(46);
    await look(page, { azimuth: 0.35, polar: 1.0, distance: 7, target: [x, 0.6, z] });
    await snapMoment(page, value, 'Laddered', 1300, '06-bridge');
    await context.close();
    return problems;
  },

  /** Hard with every snake and bridge raised (the review hook `revealAll(true)`), at Fit. */
  async hard(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'hard', fast: true });
    await playPlans(page, { 0: [3, 5], 1: [5, 4], 2: [2, 5], 3: [1, 5] });
    await page.evaluate(() => window.__app.setFast(false));
    await page.evaluate(() => window.__app.revealAll(true));
    await page.evaluate(() => window.__app.camera.fit());
    await snap(page, '07-hard-board', 6000); // snakes and bridges load on first reveal
    await context.close();
    return problems;
  },

  /** Three humans; Rama walks all the way to 144. */
  async win(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy', players: PLAYERS.slice(0, 3) });
    const value = await walkTo(page, 1, 144, EASY_SNAKES);
    await roll(page, value);
    await page.waitForFunction(() => window.__app.state().winShown, null, { timeout: 30_000 });
    await snap(page, '09-win', 2500);
    await context.close();
    return problems;
  },

  /** Hindi from the title screen, then Hanuman's first roll of 4 climbs Vishwamitra's bridge (4 -> 25). */
  async hindi(browser) {
    const { context, page, problems } = await open(browser);
    await page.click('[data-testid=language]');
    await startGame(page, { level: 'easy' });
    await snapMoment(page, 4, 'Laddered', 900, '10-hindi');
    await context.close();
    return problems;
  },

  async phone(browser) {
    const { context, page, problems } = await open(browser, { viewport: PHONE, touch: true });
    await startGame(page, { level: 'easy', fast: true });
    await playPlans(page, { 0: [3, 5], 1: [5, 3], 2: [2, 1], 3: [1, 5] });
    await page.evaluate(() => window.__app.setFast(false));
    await page.evaluate(() => window.__app.camera.fit());
    await snap(page, '11-phone', 2500);
    await context.close();
    return problems;
  },

  async rotate(browser) {
    const { context, page, problems } = await open(browser, { viewport: PORTRAIT, touch: true });
    await page.waitForSelector('[data-testid=rotate]', { timeout: 10_000 });
    await snap(page, '12-rotate');
    await context.close();
    return problems;
  },

  /** The die's tray on the oak ledge, close, then the pause menu (Esc). */
  async tray(browser) {
    const { context, page, problems } = await open(browser);
    await startGame(page, { level: 'easy' });
    await look(page, { azimuth: 0.5, polar: 0.9, distance: 6, target: [7.4, -0.75, 5.6] });
    await snap(page, '13-tray');
    await page.evaluate(() => window.__app.camera.fit());
    await page.keyboard.press('Escape');
    await snap(page, '14-menu', 1500);
    await context.close();
    return problems;
  },
};

async function main() {
  await assertPortFree();
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const server = startServer();
  let browser;
  const problems = [];
  try {
    await waitForServer();
    browser = await launch();
    for (const [name, scene] of Object.entries(SCENES)) {
      if (ONLY && !ONLY.includes(name)) continue;
      console.log(name);
      problems.push(...(await scene(browser)).map((p) => `${name}: ${p}`));
    }
    await toWebp(browser, FRAMES, OUT, 0.82);
  } catch (error) {
    problems.push(`screenshot run failed: ${error.message}`);
  } finally {
    await browser?.close();
    stopServer(server);
  }
  if (problems.length > 0) {
    console.error(`${problems.length} problem(s) while taking screenshots:\n  ${problems.join('\n  ')}`);
    console.error('SCREENSHOTS FAILED');
    process.exitCode = 1;
  } else {
    console.log('SCREENSHOTS OK');
  }
}

await main();
