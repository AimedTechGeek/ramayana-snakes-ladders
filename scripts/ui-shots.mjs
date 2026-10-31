// Screenshots of every screen at 1280x720 and 844x390 (DPR 2), English and Hindi, plus a hit-area and overflow audit.
// Usage: node scripts/ui-shots.mjs <outDir> [baseUrl]   (default baseUrl http://localhost:4181: `npx vite --port 4181`)
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const OUT = process.argv[2] ?? 'ui-shots';
const BASE = process.argv[3] ?? 'http://localhost:4181';
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '844x390', width: 844, height: 390 },
];
const PORTRAITS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '720x1280', width: 720, height: 1280 },
];
const LOCALES = ['en', 'hi'];
const MIN_HIT = 44;

async function open(browser, viewport, locale, { hash = '', slowFonts = false } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: viewport.width < 900,
  });
  await context.addInitScript((value) => {
    if (!sessionStorage.getItem('shots-init')) {
      localStorage.setItem('rsl.locale', value);
      sessionStorage.setItem('shots-init', '1');
    }
  }, locale);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico'))
      problems.push(`console: ${m.text()}`);
  });
  if (slowFonts) {
    await page.route('**/fonts/**', async (route) => {
      const url = route.request().url();
      if (url.includes('Eczar') || url.includes('Poppins-600')) await new Promise((r) => setTimeout(r, 5000));
      await route.continue();
    });
  }
  await page.goto(BASE + hash, slowFonts ? { waitUntil: 'commit' } : {});
  return { context, page, problems };
}

async function ready(page) {
  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

const config = (controllers, level = 'easy') => ({
  level,
  playOn: false,
  players: ['rama', 'hanuman', 'lakshmana', 'sita'].slice(0, controllers.length).map((hero, i) => ({
    hero,
    controller: controllers[i],
    name: ['Rama', 'Hanuman', 'Lakshmana', 'Sita'][i],
  })),
});

/** Interactive controls under 44 px, and elements that stick out of the viewport or clip their text. */
async function audit(page, label) {
  const found = await page.evaluate((min) => {
    const bad = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const name = (el) =>
      el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.className || el.tagName;
    for (const el of document.querySelectorAll('button, input, [role=radio], [role=switch]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < min - 0.5 || r.height < min - 0.5)
        bad.push(`hit ${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of document.querySelectorAll('.screen *, .scrim *, .rotate *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('svg') || el.closest('.win-sparkles')) continue;
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1)
        bad.push(
          `outside ${name(el)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`,
        );
      const style = getComputedStyle(el);
      if (
        el.scrollWidth > el.clientWidth + 1 &&
        style.overflow === 'visible' &&
        el.children.length === 0 &&
        style.display !== 'inline'
      )
        bad.push(`overflow ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
    }
    return bad;
  }, MIN_HIT);
  if (found.length) console.log(`  AUDIT ${label}:\n    ${[...new Set(found)].join('\n    ')}`);
  return found;
}

async function shoot(page, file, label) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  await audit(page, label);
}

async function playUntilBubble(page) {
  await page.evaluate(() => window.__app.setFast(false));
  for (let i = 0; i < 40; i++) {
    const rolled = page.evaluate(async () => {
      while (window.__app.isBusy) await new Promise((r) => setTimeout(r, 30));
      const { game } = window.__app.state();
      if (game.players[game.current]?.controller === 'bot') return;
      await window.__app.requestRoll();
    });
    for (let k = 0; k < 120; k++) {
      if (await page.locator('[data-testid^=bubble-]').count()) {
        await page.waitForTimeout(250);
        return true;
      }
      await page.waitForTimeout(50);
    }
    await rolled;
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const problems = [];
  try {
    for (const locale of LOCALES) {
      for (const vp of VIEWPORTS) {
        const tag = `${locale}-${vp.name}`;
        console.log(tag);

        // Loading: the late fonts keep it up.
        {
          const { context, page, problems: p } = await open(browser, vp, locale, { slowFonts: true });
          await page.waitForSelector('[data-testid=loading]');
          await page.waitForTimeout(900);
          await shoot(page, `${tag}-loading`, `${tag} loading`);
          problems.push(...p);
          await context.close();
        }

        const { context, page, problems: p } = await open(browser, vp, locale);
        await ready(page);
        await shoot(page, `${tag}-boot`, `${tag} boot`);

        await page.click('[data-testid=play]');
        await page.waitForSelector('[data-testid=setup]');
        await page.click('[data-testid=seat-2-bot]');
        await shoot(page, `${tag}-setup`, `${tag} setup`);

        // Keyboard flow: Tab reaches Start, which can be activated with Enter.
        await page.click('[data-testid=start]');
        await page.waitForFunction(
          () => window.__app.state().screen === 'game' && document.querySelector('canvas'),
        );
        await page.waitForFunction(() => !window.__app.isBusy, null, { timeout: 15_000 }).catch(() => {});
        const got = await playUntilBubble(page);
        if (!got) console.log('  (no bubble caught)');
        await shoot(page, `${tag}-game`, `${tag} game`);
        await page.waitForTimeout(2500);

        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid=menu-dialog]');
        await shoot(page, `${tag}-menu`, `${tag} menu`);
        await page.keyboard.press('Escape');

        // Resume prompt: the autosave exists after the first rolls.
        await page.reload();
        await ready(page);
        await page.waitForSelector('[data-testid=resume]');
        await shoot(page, `${tag}-resume`, `${tag} resume`);

        await page.evaluate(() => (location.hash = '#gallery'));
        await page.reload();
        await ready(page);
        await page.waitForSelector('[data-testid=gallery-screen]');
        await shoot(page, `${tag}-gallery`, `${tag} gallery`);
        problems.push(...p);
        await context.close();

        // Win: four bots play on Fast until someone reaches the throne.
        {
          const win = await open(browser, vp, locale);
          await ready(win.page);
          await win.page.evaluate(
            (c) => {
              window.__app.setFast(true);
              return window.__app.startGame(c);
            },
            config(['bot', 'bot', 'bot', 'bot'], 'easy'),
          );
          try {
            await win.page.waitForSelector('[data-testid=win]', { timeout: 240_000 });
            await shoot(win.page, `${tag}-win`, `${tag} win`);
          } catch {
            console.log('  (no winner within the time limit)');
          }
          problems.push(...win.problems);
          await win.context.close();
        }
      }
    }
    for (const locale of LOCALES) {
      for (const vp of PORTRAITS) {
        const { context, page, problems: p } = await open(browser, vp, locale);
        await ready(page);
        await page.waitForSelector('[data-testid=rotate]');
        await shoot(page, `${locale}-${vp.name}-rotate`, `${locale} ${vp.name} rotate`);
        problems.push(...p);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (problems.length) console.log(`PROBLEMS\n  ${problems.join('\n  ')}`);
  console.log('done');
}

await main();
