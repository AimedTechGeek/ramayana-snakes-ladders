// Screenshots for the README and the user guide: serves the build on its own port, drives Edge through the
// app's own screens and writes PNGs to docs/images/. Run `npm run build` first.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const PORT = 4176;
const URL = `http://localhost:${PORT}`;
const OUT = 'docs/images';
const LANDSCAPE = { width: 1280, height: 720 };
const PORTRAIT = { width: 390, height: 844 };
const SERVER_TIMEOUT_MS = 30_000;
const TURN_LIMIT = 400;

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

/** A fresh browser context, so each shot starts with empty localStorage (no autosave, English). */
async function openGame(browser, { viewport = LANDSCAPE, touch = false, hash = '' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: touch });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico'))
      problems.push(`console: ${m.text()}`);
  });
  await page.goto(URL + hash);
  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 15_000 });
  return { context, page, problems };
}

/** Waits for the frame to settle after any scene change, then saves the canvas. */
async function shoot(page, name) {
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}` });
  console.log(`  wrote ${OUT}/${name}`);
}

/** Boot -> Setup (seat 3 set to Bot, so three seats show) -> Start. Resolves when the board is up. */
async function startThreeSeatGame(page) {
  await page.click('[data-testid=play]');
  await page.click('[data-testid=seat-2-bot]');
  await page.click('[data-testid=start]');
  await page.waitForFunction(
    () => window.__app.state().screen === 'game' && document.querySelector('canvas'),
  );
}

/** Rolls for the human until `rolls` human turns have been taken, Fast, then waits until the board is idle. */
async function playRolls(page, rolls) {
  await page.evaluate(async (target) => {
    const app = window.__app;
    const idle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
    app.setFast(true);
    let taken = 0;
    while (taken < target && !app.state().game.over) {
      if (app.isBusy) {
        await idle();
        continue;
      }
      const { game } = app.state();
      if (game.players[game.current]?.controller === 'bot') {
        await idle(100);
        continue;
      }
      await app.requestRoll();
      taken++;
    }
    while (app.isBusy) await idle();
    app.setFast(false);
  }, rolls);
}

async function shotTitle(browser) {
  const { context, page, problems } = await openGame(browser);
  await shoot(page, '01-title.png');
  await context.close();
  return problems;
}

async function shotSetup(browser) {
  const { context, page, problems } = await openGame(browser);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=seat-2-bot]');
  await shoot(page, '02-setup.png');
  await context.close();
  return problems;
}

async function shotBoard(browser) {
  const { context, page, problems } = await openGame(browser);
  await startThreeSeatGame(page);
  await playRolls(page, 6);
  await shoot(page, '03-board.png');
  await context.close();
  return problems;
}

/** Starts a two-player game and rolls until a ladder or a snake happens, then shoots 250 ms later. */
async function shotReaction(browser) {
  const { context, page, problems } = await openGame(browser);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=start]');
  await page.waitForFunction(() => window.__app.state().screen === 'game');
  const kind = await page.evaluate(async (limit) => {
    const app = window.__app;
    const idle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
    for (let turn = 0; turn < limit; turn++) {
      const type = app.state().lastEvent?.type;
      if (type === 'Laddered' || type === 'Bitten') {
        await idle(250);
        return type;
      }
      if (!app.isBusy) await app.requestRoll();
      await idle(20);
    }
    return 'none';
  }, TURN_LIMIT * 20);
  console.log(`  reaction event: ${kind}`);
  await shoot(page, '04-reaction.png');
  await context.close();
  return problems;
}

/** Starts a game straight from the Boot screen. */
async function startGameDirectly(page, level, players) {
  await page.evaluate(({ level, players }) => window.__app.startGame({ level, playOn: false, players }), {
    level,
    players,
  });
}

const THREE_PLAYERS = [
  { hero: 'rama', controller: 'human', name: 'Rama' },
  { hero: 'hanuman', controller: 'bot', name: 'Hanuman' },
  { hero: 'lakshmana', controller: 'bot', name: 'Lakshmana' },
];

async function shotHardBoard(browser) {
  const { context, page, problems } = await openGame(browser);
  await startGameDirectly(page, 'hard', THREE_PLAYERS);
  await shoot(page, '05-hard-board.png');
  await context.close();
  return problems;
}

async function shotWin(browser) {
  const { context, page, problems } = await openGame(browser);
  await startGameDirectly(page, 'easy', THREE_PLAYERS);
  await page.evaluate(async (limit) => {
    const app = window.__app;
    const idle = (ms = 30) => new Promise((r) => setTimeout(r, ms));
    app.setFast(true);
    for (let turn = 0; turn < limit && !app.state().game.over; turn++) {
      if (!app.isBusy) await app.requestRoll();
      await idle();
    }
  }, TURN_LIMIT * 50);
  await page.waitForFunction(() => window.__app.state().winShown, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  await shoot(page, '06-win.png');
  await context.close();
  return problems;
}

async function shotHindi(browser) {
  const { context, page, problems } = await openGame(browser);
  await page.click('[data-testid=language]');
  await startThreeSeatGame(page);
  await playRolls(page, 4);
  await shoot(page, '07-hindi.png');
  await context.close();
  return problems;
}

async function shotHeroes(browser) {
  const { context, page, problems } = await openGame(browser, { hash: '#gallery' });
  await shoot(page, '08-heroes.png');
  await context.close();
  return problems;
}

async function shotRotate(browser) {
  const { context, page, problems } = await openGame(browser, { viewport: PORTRAIT, touch: true });
  await page.waitForSelector('[data-testid=rotate]', { timeout: 10_000 });
  await shoot(page, '09-rotate.png');
  await context.close();
  return problems;
}

const SHOTS = [
  shotTitle,
  shotSetup,
  shotBoard,
  shotReaction,
  shotHardBoard,
  shotWin,
  shotHindi,
  shotHeroes,
  shotRotate,
];

async function main() {
  await assertPortFree();
  await mkdir(OUT, { recursive: true });
  const server = startServer();
  let browser;
  const problems = [];
  try {
    await waitForServer();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const shot of SHOTS) {
      console.log(shot.name);
      problems.push(...(await shot(browser)));
    }
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
