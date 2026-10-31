// Headless msedge driver for the D3 spike page: screenshots, fps (4x CPU throttle, DPR 2, 844x390) and foot drift.
//   node scripts/blender/spike-check.mjs <outDir> [baseUrl]    (dev server: npx vite --port 5199)
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const outDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5199';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: process.env.SPIKE_SWIFTSHADER ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const report = {};
const errors = [];

async function open(viewport, dpr, query = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/spike.html${query}`);
  await page.waitForFunction(() => window.__spike?.ready, null, { timeout: 30000 });
  return page;
}

// ---- screenshots (desktop viewport, DPR 1 for readable files)
{
  const page = await open({ width: 960, height: 640 }, 1);
  const cycle = await page.evaluate(() => window.__spike.cycleSeconds());
  report.cycleSeconds = cycle;
  const shots = [
    ['idle', 'idle', 0.4, 'front'],
    ['walk-contact', 'walk', 0, 'three'],
    ['walk-pass', 'walk', cycle * 0.25 - cycle / 24, 'three'],
    ['walk-contact2', 'walk', cycle * 0.5, 'three'],
    ['walk-side', 'walk', cycle * 0.125, 'orbit'],
    ['orbit', 'idle', 0.8, 'orbit'],
    ['close', 'idle', 0.4, 'close'],
  ];
  for (const [name, mode, t, cam] of shots) {
    await page.evaluate(
      ([m, tt, c]) => {
        window.__spike.setCamera(c);
        window.__spike.pose(m, tt);
      },
      [mode, t, cam],
    );
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${outDir}/${name}.png` });
  }
  // foot drift: planted ankle world position (straight-line travel) across contact frames
  const n = 24;
  const samples = await page.evaluate((nn) => window.__spike.footSamples(nn), n);
  const stats = await page.evaluate(() => window.__spike.stats());
  Object.assign(report, { stats });
  const stride = 0.4;
  const half = n / 2;
  const drift = {};
  for (const [foot, key, start] of [
    ['L', 'L', 0],
    ['R', 'R', half],
  ]) {
    // stance window: frames start+1..start+half-1 (interior, excluding hand-off blend frames)
    const z = [];
    for (let i = start + 1; i < start + half - 1; i++) z.push(samples[i][key][2]);
    drift[foot] = {
      zRange: Math.max(...z) - Math.min(...z),
      stridePct: ((Math.max(...z) - Math.min(...z)) / stride) * 100,
    };
  }
  // contact frames (0 and 12): world z delta between consecutive same-foot contacts over a half cycle
  const ground = samples.map((s) => Math.min(s.L[1], s.R[1]));
  report.footDrift = drift;
  report.minFootY = Math.min(...ground);
  report.stanceSamples = {
    L: samples.slice(0, half + 1).map((s) => +s.L[2].toFixed(4)),
    R: samples.slice(half, n + 1).map((s) => +s.R[2].toFixed(4)),
  };
  await page.context().close();
}

// ---- fps: 844x390 DPR 2, 4x CPU throttle
for (const mode of ['walk', 'idle']) {
  const page = await open({ width: 844, height: 390 }, 2, `?mode=${mode}&cam=walk`);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1500);
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => window.__spike.stats().fps));
  }
  report[`fps_${mode}_4xThrottle_dpr2`] = {
    samples: samples.map((s) => +s.toFixed(1)),
    avg: +(samples.reduce((a, b) => a + b) / samples.length).toFixed(1),
  };
  if (mode === 'walk') await page.screenshot({ path: `${outDir}/mobile-844x390.png` });
  await page.context().close();
}

await browser.close();
report.consoleErrors = errors;
await writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
