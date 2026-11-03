// Captures of the named stages (T46.5, T46.6): the signposts at Fit on desktop and phone, signpost close-ups (the start
// signpost at Focus with a hero beside it, Ayodhya's and Lanka's, one in Hindi), the chapter card at game start and on
// entering Ayodhya, in English and (switched live) Hindi, and the card under reduced motion.
// Usage: node scripts/stages-shots.mjs <outDir> [baseUrl]   (default baseUrl http://localhost:5184: `npx vite --port 5184`)
import { DESKTOP, PHONE, launch, openApp, roll, settle, shot, startGame } from './review/lib.mjs';

const OUT = process.argv[2] ?? 'screenshots-tmp/t46b-signposts';
const BASE = process.argv[3] ?? 'http://localhost:5184';

/** The default game (T46.4): the four brothers. */
const BROTHERS = [
  { hero: 'rama', controller: 'human', name: 'Rama' },
  { hero: 'lakshmana', controller: 'human', name: 'Lakshmana' },
  { hero: 'bharata', controller: 'human', name: 'Bharata' },
  { hero: 'shatrughna', controller: 'human', name: 'Shatrughna' },
];

/** A save with Rama on 36 (Mithila's last square), so a roll of 1 enters Ayodhya on Manthara's head (no stages saved: seeded). */
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
  await page.waitForTimeout(900); // the sign atlas repaints once Eczar's Devanagari is in
}

/** Fit on desktop and phone, the signposts of fogged blocks tarnished; the start card right after the game opens. */
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
    // Rama steps onto 2, beside Mithila's signpost
    await app.page.evaluate(() => window.__queue.push(2));
    await app.page.evaluate(() => void window.__app.requestRoll());
    await settle(app.page);
    await app.page.evaluate(() => window.__app.camera.fit());
    await app.page.waitForTimeout(1500);
    await shot(app.page, OUT, `fit-${name}-hero-on-2`);
    problems.push(...app.problems);
    await app.context.close();
  }
  return problems;
}

/** A close camera on a three-space point at the default heading (a little from the right), for a signpost close-up. */
const near = (target, distance = 3.2) => ({ azimuth: 0.38, polar: 1.0, distance, target });

/**
 * Signposts up close: the start signpost at Focus with Rama beside it on square 1 (the scale against a hero), then in
 * Hindi; Ayodhya's on the outer front corner of 37 and Lanka's behind 121's token field.
 */
async function closeUps(browser) {
  const { page, problems, context } = await openApp(browser, BASE);
  await startGame(page, { level: 'easy', players: BROTHERS });
  await page.waitForTimeout(3500); // the start card leaves
  await roll(page, 1); // Rama walks through the gate onto 1
  // his brothers walk on to 2, 3 and 5, so it is Rama's turn again and Focus frames him beside the start signpost
  for (const value of [2, 3, 5]) await roll(page, value);
  await page.evaluate(() => window.__app.camera.focus());
  await page.waitForTimeout(1500);
  await shot(page, OUT, 'sign-focus-start-en');
  await page.evaluate((pose) => window.__app.camera.set(pose), near([-5.3, 0.5, 5.2]));
  await page.waitForTimeout(1000);
  await shot(page, OUT, 'sign-close-start-en');
  await switchLanguage(page);
  await shot(page, OUT, 'sign-close-start-hi');
  await switchLanguage(page);
  for (const [name, target] of [
    ['ayodhya', [5.9, 0.9, 2.9]],
    ['dandaka', [-5.95, 0.95, 1.7]],
    ['kishkindha', [5.95, 1.5, -1.25]],
    ['lanka', [-5.3, 1.95, -4.9]],
    ['throne', [-5.5, 2.1, -5.25]],
  ]) {
    await page.evaluate((pose) => window.__app.camera.set(pose), near(target));
    await page.waitForTimeout(1000);
    await shot(page, OUT, `sign-close-${name}-en`);
  }
  await context.close();
  return problems;
}

/** Resume a save with Rama on 36 and roll 1: he steps into Ayodhya onto Manthara's head; the card waits for the bite. */
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
    await page.evaluate((v) => window.__queue.push(v), 1);
    await page.evaluate(() => void window.__app.requestRoll());
    await page.waitForSelector('[data-testid=chapter-card][data-stage=ayodhya]', { timeout: 20000 });
    await page.waitForTimeout(reducedMotion ? 200 : 500);
    await shot(page, OUT, `card-ayodhya-${locale}${suffix}`);
    await settle(page);
    await context.close();
  }
  return problems;
}

/** The game-start card in Hindi (the language chosen before the game). */
async function startCardHindi(browser) {
  const context = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('rsl.locale', 'hi'));
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__app?.ready === true, null, { timeout: 30000 });
  await page.evaluate(
    (players) => window.__app.startGame({ level: 'easy', playOn: false, players }),
    BROTHERS,
  );
  await page.waitForSelector('[data-testid=chapter-card]', { timeout: 10000 });
  await page.waitForTimeout(700);
  await shot(page, OUT, 'card-start-desktop-hi');
  await context.close();
  return problems;
}

const browser = await launch();
const problems = [
  ...(await fitScenes(browser)),
  ...(await closeUps(browser)),
  ...(await startCardHindi(browser)),
  ...(await ayodhyaCard(browser)),
  ...(await ayodhyaCard(browser, { reducedMotion: true, suffix: '-reduced' })),
];
await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log('stages shots OK');
