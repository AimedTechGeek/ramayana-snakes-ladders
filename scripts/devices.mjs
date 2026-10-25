// Device check: serves the build on its own port, then for each viewport loads the game in Edge, plays turns
// in fast mode and asserts the canvas fits, nothing errors, the frame rate holds and portrait shows the rotate prompt.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const PORT = 4175;
const URL = `http://localhost:${PORT}`;
const OUT = 'screenshots-tmp/devices';
// Headless Edge caps requestAnimationFrame near 30 fps, so 24 leaves margin while still catching real stalls.
const MIN_FPS = 24;

const DEVICES = [
  { name: 'laptop-1280x720', width: 1280, height: 720 },
  { name: 'ipad-landscape-1024x768', width: 1024, height: 768, touch: true },
  { name: 'ipad-pro-landscape-1366x1024', width: 1366, height: 1024, touch: true },
  { name: 'phone-landscape-844x390', width: 844, height: 390, touch: true },
  { name: 'phone-portrait-390x844', width: 390, height: 844, touch: true, portrait: true },
];

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
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no server at ${URL}`);
}

/** Starts a 1 human + 1 bot game via the game's own scenes and plays a few fast turns. */
async function playTurns(page) {
  await page.evaluate(() =>
    window.__game.scene.start('Board', {
      config: {
        level: 'hard',
        playOn: false,
        players: [
          { hero: 'rama', controller: 'human', name: 'Rama' },
          { hero: 'hanuman', controller: 'bot', name: 'Hanuman' },
          { hero: 'sita', controller: 'bot', name: 'Sita' },
          { hero: 'lakshmana', controller: 'bot', name: 'Lakshmana' },
        ],
      },
    }),
  );
  await page.waitForFunction(() => window.__game.registry.get('board-ready') === true);
  return page.evaluate(async () => {
    const board = window.__game.registry.get('board');
    board.fastMode = true;
    let frames = 0;
    let counting = true;
    const tick = () => {
      frames++;
      if (counting) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const start = performance.now();
    for (let i = 0; i < 8 && !board.snapshot().over; i++) {
      while (board.isBusy) await new Promise((r) => setTimeout(r, 30));
      await board.requestRoll();
    }
    counting = false;
    return { fps: (frames * 1000) / (performance.now() - start) };
  });
}

async function checkDevice(browser, device) {
  const problems = [];
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    hasTouch: Boolean(device.touch),
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico'))
      problems.push(`console: ${m.text()}`);
  });
  await page.goto(URL);
  await page.waitForFunction(() => window.__game?.registry.get('ready') === true, null, { timeout: 15_000 });

  const box = await page.locator('canvas').boundingBox();
  if (!box || box.width > device.width + 1 || box.height > device.height + 1) {
    problems.push(`canvas ${JSON.stringify(box)} does not fit ${device.width}x${device.height}`);
  }
  if (device.portrait) {
    const rotating = await page.evaluate(() => window.__game.scene.isVisible('Rotate'));
    if (!rotating) problems.push('portrait viewport does not show the rotate prompt');
  } else {
    const { fps } = await playTurns(page);
    if (fps < MIN_FPS) problems.push(`frame rate ${fps.toFixed(0)} < ${MIN_FPS}`);
    console.log(
      `  ${device.name}: ${fps.toFixed(0)} fps, canvas ${Math.round(box.width)}x${Math.round(box.height)}`,
    );
  }
  await page.screenshot({ path: `${OUT}/${device.name}.png` });
  await context.close();
  return problems;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = startServer();
  let browser;
  let failed = false;
  try {
    await waitForServer();
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const device of DEVICES) {
      const problems = await checkDevice(browser, device);
      if (problems.length > 0) {
        failed = true;
        console.error(`FAIL ${device.name}\n  ${problems.join('\n  ')}`);
      } else {
        console.log(`ok   ${device.name}`);
      }
    }
  } finally {
    await browser?.close();
    stopServer(server);
  }
  console.log(failed ? 'DEVICES FAILED' : 'DEVICES OK');
  process.exitCode = failed ? 1 : 0;
}

await main();
