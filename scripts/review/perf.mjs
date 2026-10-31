// Performance and download numbers for the review (spec 10), through `window.__app` only.
//   node scripts/review/perf.mjs <baseUrl> [level=hard] [dist=dist]
// For each profile (desktop 1280x720, phone 844x390): a 4-bot game in Fast to the Win screen, renderer counters
// sampled every second; then every block, snake and bridge of the board revealed and Fit, sampled again. Downloads come from the resource timing
// entries (what the browser fetched, by kind) and from dist/ (JS and CSS brotli, as served compressed).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { DESKTOP, PHONE, launch, openApp, startGame } from './lib.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const LEVEL = process.argv[3] ?? 'hard';
const DIST = process.argv[4] ?? 'dist';
const BOTS = ['hanuman', 'rama', 'sita', 'lakshmana'].map((hero) => ({ hero, controller: 'bot', name: hero }));

const kindOf = (url) => {
  if (/\/models\/snakes\//.test(url)) return 'snakes';
  if (/\/models\/bridges\//.test(url)) return 'bridges';
  if (/\/models\/heroes\//.test(url)) return 'heroes';
  if (/\.glb/.test(url)) return 'board, props, landmarks, die';
  if (/\.woff2?/.test(url)) return 'fonts';
  if (/\.js/.test(url)) return 'js';
  if (/\.css/.test(url)) return 'css';
  return 'other';
};

function summarise(samples) {
  const max = (k) => Math.max(...samples.map((s) => s[k]));
  const fps = samples.map((s) => s.fps).filter((f) => f > 0);
  return {
    samples: samples.length,
    fpsMin: Math.min(...fps),
    fpsAvg: Math.round((fps.reduce((a, b) => a + b, 0) / fps.length) * 10) / 10,
    drawCallsMax: max('drawCalls'),
    shadowCallsMax: max('shadowCalls'),
    mainCallsMax: Math.max(...samples.map((s) => s.drawCalls - s.shadowCalls)),
    trianglesMax: max('triangles'),
    textureMbMax: max('textureMb'),
  };
}

async function profile(browser, name, viewport) {
  const { page, problems, context } = await openApp(browser, BASE, { viewport, touch: viewport === PHONE });
  await startGame(page, { level: LEVEL, players: BOTS, fast: true });
  const firstBytes = await page.evaluate(() => window.__app.metrics()?.bytesLoaded ?? 0);
  const t0 = Date.now();
  const play = [];
  for (;;) {
    await page.waitForTimeout(1000);
    const m = await page.evaluate(() => window.__app.metrics());
    if (m) play.push(m);
    const s = await page.evaluate(() => window.__app.state());
    if (s.winShown || s.game?.over || Date.now() - t0 > 600_000) break;
  }
  const seconds = (Date.now() - t0) / 1000;
  await page.evaluate(() => {
    window.__app.revealAll(true);
    window.__app.camera.fit();
  });
  await page.waitForTimeout(2500);
  const all = [];
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    all.push(await page.evaluate(() => window.__app.metrics()));
  }
  const resources = await page.evaluate(() =>
    [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map((e) => ({
      url: e.name,
      bytes: e.transferSize || e.encodedBodySize || 0,
    })),
  );
  const byKind = {};
  for (const r of resources) byKind[kindOf(r.url)] = (byKind[kindOf(r.url)] ?? 0) + r.bytes;
  await context.close();
  return { name, seconds, play: summarise(play), revealed: summarise(all), firstBytes, byKind, problems };
}

/** dist/: JS and CSS brotli (how a host serves them), everything else at file size. */
function distSizes() {
  const out = {};
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const kind = kindOf(p.replace(/\\/g, '/'));
        const raw = readFileSync(p);
        const bytes = /\.(js|css|html|json|svg)$/.test(p) ? brotliCompressSync(raw).length : raw.length;
        out[kind] = (out[kind] ?? 0) + bytes;
      }
    }
  };
  walk(DIST);
  return out;
}

const browser = await launch();
const results = [];
for (const [name, viewport] of [['desktop 1280x720', DESKTOP], ['phone 844x390', PHONE]]) {
  console.log('profile', name);
  results.push(await profile(browser, name, viewport));
}
await browser.close();
for (const r of results) {
  console.log(`\n== ${r.name}: ${LEVEL} 4 bots Fast to Win in ${r.seconds.toFixed(0)} s`);
  console.log('during play  ', JSON.stringify(r.play));
  console.log('all revealed ', JSON.stringify(r.revealed));
  console.log('bytes at board ready', r.firstBytes, 'fetched by kind', JSON.stringify(r.byKind));
  console.log('problems', r.problems.length ? r.problems.join('\n') : 'none');
}
console.log('\ndist (JS/CSS brotli):', JSON.stringify(distSizes()));
