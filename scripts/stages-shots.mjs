// Captures of the named stages (T46.5): the plaques at Fit on desktop and phone, a plaque close-up, the chapter card
// at game start and on entering Ayodhya, in English and (switched live) Hindi, and the card under reduced motion.
// Usage: node scripts/stages-shots.mjs <outDir> [baseUrl]   (default baseUrl http://localhost:5184: `npx vite --port 5184`)
import { DESKTOP, PHONE, launch, openApp, settle, shot, startGame } from './review/lib.mjs';

const OUT = process.argv[2] ?? 'screenshots-tmp/t46-stages';
const BASE = process.argv[3] ?? 'http://localhost:5184';

/** The default game (T46.4): the four brothers. */
const BROTHERS = [
  { hero: 'rama', controller: 'human', name: 'Rama' },
  { hero: 'lakshmana', controller: 'human', name: 'Lakshmana' },
  { hero: 'bharata', controller: 'human', name: 'Bharata' },
  { hero: 'shatrughna', controller: 'human', name: 'Shatrughna' },
];

/** A save with Rama on 36 (Mithila's last square), so a roll of 2 walks into Ayodhya past Manthara's head on 37 (no stages recorded: seeded). */
const SAVE_AT_36 = {
  version: 2,
  state: {
    level: 'easy',
    playOn: false,
    players: [
      { hero: 'rama', controller: 'human', name: 'Rama', position: 36, rank: null },
      { hero: 'bharata', controller: 'human', name: 'Bharata', position: 9, rank: null },
    ],
    current: 0,
    sixesThisTurn: 0,
    turnStartPosition: 36,
    over: false,
  },
  reveal: { terrain: [...Array.from({ length: 36 }, (_, i) => i + 1), 144], jumps: [] },
};

async function switchLanguage(page) {
  await page.click('[data-testid=hud-language]');
  await page.waitForTimeout(900); // the atlas redraws once Eczar's Devanagari is in
}

/** Fit on desktop and phone, the plaques dimmed for unreached stages; the start card right after the game opens. */
async function fitScenes(browser) {
  const problems = [];
  for (const [name, viewport] of [
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ]) {
    const app = await openApp(browser, BASE, { viewport, touch: viewport === PHONE });
    await app.page.evaluate((config) => window.__app.startGame(config), {
      level: 'easy',
      playOn: false,
      players: BROTHERS,
    });
    await app.page.waitForSelector('[data-testid=chapter-card]', { timeout: 10000 });
    await app.page.waitForTimeout(700);
    await shot(app.page, OUT, `card-start-${name}`);
    await app.page.waitForTimeout(3500);
    await app.page.evaluate(() => window.__app.camera.fit());
    await app.page.waitForTimeout(1200);
    await shot(app.page, OUT, `fit-${name}-en`);
    await switchLanguage(app.page);
    await shot(app.page, OUT, `fit-${name}-hi`);
    await switchLanguage(app.page);
    problems.push(...app.problems);
    await app.context.close();
  }
  return problems;
}

/** A plaque up close (Mithila's, beside row 1), both languages, and the Ayodhya plaque at the right edge. */
async function closeUps(browser) {
  const { page, problems, context } = await openApp(browser, BASE);
  await startGame(page, { level: 'easy', players: BROTHERS });
  await page.evaluate(() =>
    window.__app.camera.set({ azimuth: 0.55, polar: 1.05, distance: 6.5, target: [-5.4, -0.2, 6.2] }),
  );
  await page.waitForTimeout(1000);
  await shot(page, OUT, 'plaque-close-mithila-en');
  await switchLanguage(page);
  await shot(page, OUT, 'plaque-close-mithila-hi');
  await switchLanguage(page);
  await page.evaluate(() =>
    window.__app.camera.set({ azimuth: -0.4, polar: 1.0, distance: 7, target: [5.6, 0.6, 2.4] }),
  );
  await page.waitForTimeout(1000);
  await shot(page, OUT, 'plaque-close-ayodhya-en');
  await context.close();
  return problems;
}

/** Resume a save with Rama on 36 and roll 2: the Ayodhya card slides in as he steps on 37 (en, then hi). */
async function ayodhyaCard(browser, { reducedMotion = false, suffix = '' } = {}) {
  const problems = [];
  for (const locale of ['en', 'hi']) {
    const context = await browser.newContext({
      viewport: DESKTOP,
      deviceScaleFactor: 1,
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    });
    await context.addInitScript(
      ({ save, locale }) => {
        localStorage.setItem('rsl.save.v1', JSON.stringify(save));
        localStorage.setItem('rsl.locale', locale);
      },
      { save: SAVE_AT_36, locale },
    );
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.location().url.endsWith('favicon.ico'))
        problems.push(`console: ${m.text()}`);
    });
    await page.goto(BASE);
    await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 30000 });
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
    await page.click('[data-testid=resume]');
    await page.waitForFunction(
      () => window.__app.state().screen === 'game' && document.querySelector('canvas'),
    );
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__app.camera.fit());
    await page.waitForTimeout(1000);
    // no card on resume: the seeded stages (start, Mithila) are not repeated
    const before = await page.$('[data-testid=chapter-card]');
    if (before) problems.push('a chapter card showed on resume');
    await page.evaluate((v) => window.__queue.push(v), 2);
    await page.evaluate(() => void window.__app.requestRoll());
    await page.waitForSelector('[data-testid=chapter-card][data-stage=ayodhya]', { timeout: 10000 });
    await page.waitForTimeout(reducedMotion ? 200 : 500);
    await shot(page, OUT, `card-ayodhya-${locale}${suffix}`);
    await settle(page);
    await context.close();
  }
  return problems;
}

const browser = await launch();
const problems = [
  ...(await fitScenes(browser)),
  ...(await closeUps(browser)),
  ...(await ayodhyaCard(browser)),
  ...(await ayodhyaCard(browser, { reducedMotion: true, suffix: '-reduced' })),
];
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log('stages shots OK');
