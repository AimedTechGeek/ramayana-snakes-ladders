// Smoke test: serves the built app with `vite preview`, loads it in Microsoft Edge,
// checks the app boots and the 3D board takes a roll without console/page errors, and saves a screenshot.
//
// Env:
//   SMOKE_SHOT    screenshot path (default: screenshots-tmp/smoke.png)
//   SMOKE_SCRIPT  optional JS module with `export default async (page) => {}`
//                 run before the screenshot (for extra per-feature steps)

import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const APP_URL = 'http://localhost:4173';
const SERVER_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 15_000;
const SHOT_PATH = process.env.SMOKE_SHOT || 'screenshots-tmp/smoke.png';
const SCRIPT_PATH = process.env.SMOKE_SCRIPT;
const IS_WINDOWS = process.platform === 'win32';

function startPreviewServer() {
  return spawn('npx vite preview --port 4173 --strictPort', {
    shell: true,
    stdio: 'ignore',
  });
}

function stopPreviewServer(server) {
  if (server.exitCode !== null) {
    return;
  }
  if (IS_WINDOWS) {
    // shell:true starts cmd.exe, so kill the whole process tree.
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(APP_URL);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not accepting connections yet; retry below.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`preview server did not respond at ${APP_URL} within ${timeoutMs} ms`);
}

async function runSmoke(page, errors) {
  // SMOKE_PATH opens a sub-page such as #gallery.
  await page.goto(APP_URL + (process.env.SMOKE_PATH ?? ''), { waitUntil: 'load' });

  try {
    await page.waitForFunction(() => window.__app?.ready === true, null, {
      timeout: READY_TIMEOUT_MS,
    });
  } catch {
    errors.push(`game did not report ready within ${READY_TIMEOUT_MS} ms (window.__app.ready)`);
  }

  // Through Boot and Setup to the 3D board: the default seats are a human and a bot, so the game waits for a roll.
  await page.click('[data-testid=play]');
  await page.click('[data-testid=start]');
  await page.waitForFunction(
    () => window.__app.state().screen === 'game' && document.querySelector('canvas'),
    null,
    {
      timeout: READY_TIMEOUT_MS,
    },
  );
  // The Roll pill pulses while it waits for a tap, so it never counts as "stable" for Playwright.
  await page.click('[data-testid=dice]', { force: true });
  await page.waitForFunction(
    () => window.__app.state().lastEvent?.type === 'Moved' || window.__app.state().game?.current === 1,
    null,
    {
      timeout: READY_TIMEOUT_MS,
    },
  );

  if (SCRIPT_PATH) {
    const extraSteps = await import(pathToFileURL(resolve(SCRIPT_PATH)).href);
    await extraSteps.default(page);
  }

  await mkdir(dirname(resolve(SHOT_PATH)), { recursive: true });
  await page.screenshot({ path: SHOT_PATH });
}

/** A server already answering on the port would be tested instead of this build, so refuse to run. */
async function assertPortFree() {
  try {
    await fetch(APP_URL);
  } catch {
    return; // nothing listening: the port is free
  }
  console.error(`${APP_URL} is already serving (a stale vite preview?). Stop it and rerun.`);
  console.error('SMOKE FAILED');
  process.exit(1);
}

async function main() {
  await assertPortFree();
  const errors = [];
  const server = startPreviewServer();
  let browser;

  try {
    await waitForServer(SERVER_TIMEOUT_MS);
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    page.on('console', (message) => {
      if (message.type() !== 'error') {
        return;
      }
      // The browser requests /favicon.ico automatically; the app ships no icon, so ignore that 404.
      if (message.location().url.endsWith('/favicon.ico')) {
        return;
      }
      errors.push(`console error: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      errors.push(`page error: ${error.message}`);
    });

    await runSmoke(page, errors);
  } catch (error) {
    errors.push(`smoke run failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    stopPreviewServer(server);
  }

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    console.error('SMOKE FAILED');
    process.exitCode = 1;
  } else {
    console.log('SMOKE OK');
  }
}

await main();
