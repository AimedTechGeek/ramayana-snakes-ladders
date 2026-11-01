// Shared helpers for the review captures (scripts/review/capture.mjs). Everything goes through the stable
// `window.__app` hooks plus one test seam: the dice. `crypto.getRandomValues` is wrapped so a queued value comes
// out of the next roll, which lets a scene put a hero on an exact square through ordinary turns.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export const PLAYERS = [
  { hero: 'hanuman', controller: 'human', name: 'Hanuman' },
  { hero: 'rama', controller: 'human', name: 'Rama' },
  { hero: 'sita', controller: 'human', name: 'Sita' },
  { hero: 'lakshmana', controller: 'human', name: 'Lakshmana' },
];

export const DESKTOP = { width: 1280, height: 720 };
export const PHONE = { width: 844, height: 390 };

export async function launch() {
  return chromium.launch({ channel: 'msedge', headless: true });
}

/** A fresh page on the app, ready (`__app.ready`), with console/page errors collected into `problems`. */
export async function openApp(
  browser,
  base,
  { viewport = DESKTOP, reducedMotion = false, touch = false } = {},
) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
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
  await page.goto(base);
  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 30000 });
  await installDice(page);
  return { page, problems, context };
}

/** Queued dice: `roll(page, v)` makes the next roll come out as v. */
async function installDice(page) {
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
}

export async function startGame(page, { level = 'easy', players = PLAYERS, fast = false } = {}) {
  await page.evaluate((config) => window.__app.startGame(config), { level, playOn: false, players });
  await page.waitForFunction(() => document.querySelector('canvas'));
  await page.evaluate((on) => window.__app.setFast(on), fast);
  await page.waitForTimeout(2500);
}

export const settle = (page, timeout = 90000) =>
  page.waitForFunction(() => !window.__app.isBusy, null, { timeout });

export const current = (page) => page.evaluate(() => window.__app.state().game.current);
export const positions = (page) =>
  page.evaluate(() => window.__app.state().game.players.map((p) => p.position));

/** Rolls `value` for whoever is up and waits for the turn to finish. */
export async function roll(page, value) {
  await page.evaluate((v) => window.__queue.push(v), value);
  await page.evaluate(() => window.__app.requestRoll());
  await settle(page);
}

/** Plays rolls so that `seat` follows `plan`; every other seat rolls `filler` (pick one that lands nowhere special). */
export async function drive(page, seat, plan, fillers = {}) {
  for (const value of plan) {
    for (;;) {
      const who = await current(page);
      if (who === seat) break;
      const pending = fillers[who];
      await roll(page, Array.isArray(pending) ? (pending.shift() ?? 1) : (pending ?? 1));
    }
    await roll(page, value);
  }
}

/** Waits until it is `seat`'s turn, letting the other seats roll their fillers. */
export async function waitTurn(page, seat, fillers = {}) {
  for (;;) {
    const who = await current(page);
    if (who === seat) return;
    const pending = fillers[who];
    await roll(page, Array.isArray(pending) ? (pending.shift() ?? 1) : (pending ?? 1));
  }
}

/** Camera aimed at a board point (three units: x right, y up, z toward the viewer). */
export async function look(page, pose, waitMs = 900) {
  await page.evaluate((p) => window.__app.camera.set(p), pose);
  await page.waitForTimeout(waitMs);
}

/** Centre of a square on the board (the layout module is pure, so the review mirrors its maths). */
export function squareCentre(square) {
  const index = square - 1;
  const row = Math.floor(index / 12);
  const col = row % 2 === 0 ? index % 12 : 11 - (index % 12);
  return [col - 5.5, 5.5 - row];
}

export async function shot(page, out, name, opts = {}) {
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: join(out, `${name}.png`), ...opts });
  console.log('shot', name);
}

/** PNG -> WebP through a browser canvas (Playwright writes only PNG/JPEG). Returns total bytes. */
export async function toWebp(browser, src, dst, quality = 0.8) {
  await mkdir(dst, { recursive: true });
  const page = await browser.newPage();
  let total = 0;
  for (const name of (await readdir(src)).filter((f) => f.endsWith('.png'))) {
    const png = (await readFile(join(src, name))).toString('base64');
    const data = await page.evaluate(
      async ({ png, q }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/webp', q).split(',')[1];
      },
      { png, q: quality },
    );
    const out = join(dst, name.replace(/\.png$/, '.webp'));
    await writeFile(out, Buffer.from(data, 'base64'));
    const size = (await stat(out)).size;
    total += size;
    console.log(out, `${(size / 1024).toFixed(0)} KB`);
  }
  await page.close();
  console.log(`TOTAL ${(total / 1024).toFixed(0)} KB`);
  return total;
}

/** A contact sheet of PNG frames (`names` inside `dir`), `cols` across at `w` x `h` each. */
export async function sheet(browser, dir, names, outPath, { cols = 4, w = 480, h = 270 } = {}) {
  const urls = await Promise.all(
    names.map(async (n) => 'data:image/png;base64,' + (await readFile(join(dir, n))).toString('base64')),
  );
  const page = await browser.newPage({
    viewport: { width: cols * w, height: h * Math.ceil(urls.length / cols) },
  });
  await page.setContent(
    `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${w}px)">` +
      urls
        .map(
          (u, i) =>
            `<div style="position:relative"><img src="${u}" width="${w}" height="${h}"><b style="position:absolute;left:4px;top:2px;color:#fff;background:#000a;font:12px sans-serif;padding:1px 4px">${names[i]}</b></div>`,
        )
        .join('') +
      '</body>',
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
}
