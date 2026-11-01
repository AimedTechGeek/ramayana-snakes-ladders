// Review-pack captures from a running app (dev server or `vite preview`), through `window.__app` and queued dice.
//   node scripts/review/capture.mjs <outDir> <baseUrl> [scene,scene,...]
// Scenes: fit, tray, heroes, bites, kaikeyi (with the wedding bridge crossing), win. PNGs land in <outDir>; then
//   node scripts/review/webp.mjs <outDir> <imagesDir> <name,name,...>
// encodes the picks for the review document.
import { readdir } from 'node:fs/promises';
import {
  DESKTOP,
  PHONE,
  launch,
  look,
  openApp,
  positions,
  roll,
  settle,
  sheet,
  shot,
  squareCentre,
  startGame,
  waitTurn,
} from './lib.mjs';

const OUT = process.argv[2] ?? 'screenshots-tmp/review';
const BASE = process.argv[3] ?? 'http://localhost:5173';
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;

/** Rolls of 1 keep the other seats crawling along the first rows. */
const QUIET = { 0: 1, 1: 1, 2: 1, 3: 1 };
const BOTS = ['hanuman', 'rama', 'sita', 'lakshmana'].map((hero) => ({
  hero,
  controller: 'bot',
  name: hero[0].toUpperCase() + hero.slice(1),
}));

/** Plays queued rolls per seat (whoever is up takes the next of its list, or a 1) until every list is empty. */
async function playPlans(page, plans) {
  for (;;) {
    const left = Object.values(plans).some((plan) => plan.length > 0);
    if (!left) return;
    const who = await page.evaluate(() => window.__app.state().game.current);
    await roll(page, plans[who]?.shift() ?? 1);
  }
}

/** Easy's ladder feet and snake heads: a walk to a target steps round them. */
const HEADS = new Set([4, 20, 26, 49, 85, 88, 92, 95, 101, 37, 46, 64, 70, 76, 114]);

/**
 * Plays turns in Fast until `seat` stands 1-5 squares short of `target` (never on a ladder foot or snake head);
 * the other seats shuffle on clear of every head. Returns the roll that then lands on `target`.
 */
async function walkTo(page, seat, target) {
  await page.evaluate(() => window.__app.setFast(true));
  for (;;) {
    const who = await page.evaluate(() => window.__app.state().game.current);
    const at = (await positions(page))[seat];
    if (who !== seat) {
      // the others shuffle on without climbing or being bitten (a climb could carry them past their own target)
      const other = (await positions(page))[who];
      let step = 1;
      while (step < 5 && HEADS.has(other + step)) step++;
      await roll(page, step);
      continue;
    }
    if (target - at >= 1 && target - at <= 5) break;
    let step = 5;
    while (step > 1 && (HEADS.has(at + step) || target - (at + step) < 1)) step--;
    await roll(page, step);
  }
  await page.evaluate(() => window.__app.setFast(false));
  return target - (await positions(page))[seat];
}

/** Frames of whatever plays after `start()`, until the turn settles (at most `max` frames). Returns their names. */
async function sequence(page, prefix, start, max = 60) {
  await start();
  const names = [];
  while (names.length < max) {
    const busy = await page.evaluate(() => window.__app.isBusy);
    if (!busy && names.length > 2) break;
    const name = `${prefix}-${String(names.length).padStart(2, '0')}`;
    await shot(page, OUT, name);
    names.push(`${name}.png`);
  }
  await settle(page);
  return names;
}

/** A strip of `count` evenly spaced frames from a sequence, as one image. */
async function strip(browser, names, out, count = 6) {
  const picks = Array.from(
    { length: count },
    (_, k) => names[Math.round((k * (names.length - 1)) / (count - 1))],
  );
  await sheet(browser, OUT, picks, `${OUT}/${out}.png`, { cols: 3, w: 640, h: 360 });
  console.log('strip', out);
}

/** The turn after `seat`'s roll of `value` (it must be `seat`'s turn), filmed with the camera on `pose`. */
async function film(page, seat, value, pose, prefix) {
  await waitTurn(page, seat, QUIET);
  await look(page, pose);
  await page.evaluate((v) => window.__queue.push(v), value);
  return sequence(page, prefix, () => page.evaluate(() => void window.__app.requestRoll()));
}

const SCENES = {
  /** Fit at desktop 1280x720 and phone 844x390 with four seats (the seat-card column against squares 1-3). */
  async fit(browser) {
    const problems = [];
    for (const [name, viewport] of [
      ['fit-desktop', DESKTOP],
      ['fit-phone', PHONE],
    ]) {
      const app = await openApp(browser, BASE, { viewport, touch: viewport === PHONE });
      await startGame(app.page, { level: 'easy' });
      await app.page.evaluate(() => window.__app.camera.fit());
      await app.page.waitForTimeout(1500);
      await shot(app.page, OUT, name);
      problems.push(...app.problems);
      await app.context.close();
    }
    return problems;
  },

  /** The die's tray on the oak ledge: felt, rim and the die at rest, then mid-roll. */
  async tray(browser) {
    const { page, problems, context } = await openApp(browser, BASE);
    await startGame(page, { level: 'easy' });
    await look(page, { azimuth: 0.5, polar: 0.9, distance: 6, target: [7.4, -0.75, 5.6] });
    await shot(page, OUT, 'tray-idle');
    await page.evaluate(() => window.__queue.push(3));
    await page.evaluate(() => void window.__app.requestRoll());
    await page.waitForTimeout(330);
    await shot(page, OUT, 'tray-rolling');
    await settle(page);
    await context.close();
    return problems;
  },

  /** Each hero close on the board: four humans walk to 8, 9, 7 and 6, then the camera visits each. */
  async heroes(browser) {
    const { page, problems, context } = await openApp(browser, BASE);
    await startGame(page, { level: 'easy' });
    await playPlans(page, { 0: [3, 5], 1: [5, 4], 2: [2, 5], 3: [1, 5] }); // 8, 9, 7, 6
    console.log('positions', JSON.stringify(await positions(page)));
    await page.evaluate(() => window.__app.revealAll());
    const at = await positions(page);
    for (const [seat, hero] of ['hanuman', 'rama', 'sita', 'lakshmana'].entries()) {
      const [x, z] = squareCentre(at[seat]);
      await look(page, { azimuth: 0.35, polar: 1.12, distance: 6, target: [x, 0.95, z] }, 1200);
      await shot(page, OUT, `hero-${hero}`);
    }
    await context.close();
    return problems;
  },

  /** Snake bites for two heroes on Easy: Rama on Manthara (37 -> 19), then Sita on Shurpanakha (64 -> 47). */
  async bites(browser) {
    const { page, problems, context } = await openApp(browser, BASE);
    await startGame(page, { level: 'easy' });
    const [rx, rz] = squareCentre(37);
    const toManthara = await walkTo(page, 1, 37);
    const rama = await film(
      page,
      1,
      toManthara,
      { azimuth: 0.3, polar: 1.0, distance: 6, target: [rx, 0.6, rz] },
      'bite-rama',
    );
    await strip(browser, rama, 'bite-rama-strip');
    const [sx, sz] = squareCentre(64);
    const toShurpanakha = await walkTo(page, 2, 64);
    const sita = await film(
      page,
      2,
      toShurpanakha,
      { azimuth: -0.3, polar: 1.0, distance: 6, target: [sx, 0.6, sz] },
      'bite-sita',
    );
    await strip(browser, sita, 'bite-sita-strip');
    await context.close();
    return problems;
  },

  /** Rama crosses the wedding bridge (26 -> 52), then Kaikeyi (46) strikes Hanuman behind the bowed deck. */
  async kaikeyi(browser) {
    const { page, problems, context } = await openApp(browser, BASE);
    await startGame(page, { level: 'easy' });
    const [wx, wz] = squareCentre(46); // mid-span of the wedding bridge 26 -> 52
    const pose = { azimuth: 0.35, polar: 1.0, distance: 7, target: [wx, 0.6, wz] };
    const toWedding = await walkTo(page, 1, 26);
    const cross = await film(page, 1, toWedding, pose, 'cross');
    await strip(browser, cross, 'cross-strip');
    console.log('positions', JSON.stringify(await positions(page)));
    const [x, z] = squareCentre(46);
    const near = { azimuth: -0.35, polar: 1.05, distance: 6, target: [x, 0.6, z] };
    const toKaikeyi = await walkTo(page, 0, 46);
    const bite = await film(page, 0, toKaikeyi, near, 'kaikeyi');
    await strip(browser, bite, 'kaikeyi-strip');
    await look(page, near);
    await shot(page, OUT, 'kaikeyi-after');
    await context.close();
    return problems;
  },

  /** Four bots play Easy in Fast to the Win dialog. */
  async win(browser) {
    const { page, problems, context } = await openApp(browser, BASE);
    await startGame(page, { level: 'easy', players: BOTS, fast: true });
    await page.waitForFunction(() => window.__app.state().winShown, null, { timeout: 600000, polling: 500 });
    await page.waitForTimeout(2500);
    await shot(page, OUT, 'win');
    await context.close();
    return problems;
  },
};

const browser = await launch();
const all = [];
for (const [name, scene] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.includes(name)) continue;
  console.log('scene', name);
  const problems = await scene(browser);
  all.push(...problems.map((p) => `${name}: ${p}`));
}
await browser.close();
console.log(`${(await readdir(OUT)).length} files in ${OUT}`);
console.log(all.length ? all.join('\n') : 'no console or page errors');
