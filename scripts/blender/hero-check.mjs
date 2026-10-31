// Headless msedge driver for the hero preview page (hero.html): turntable, a contact sheet per clip, planted-foot
// drift of walk and run on a straight path, and fps under 4x CPU throttle.
//   node scripts/blender/hero-check.mjs <outDir> [baseUrl] [shots|drift|fps|all] [hero]
// Needs the dev server:  npx vite --port 5311
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const outDir = process.argv[2];
const base = process.argv[3] ?? 'http://localhost:5311';
const what = process.argv[4] ?? 'all';
const hero = process.argv[5] ?? 'hanuman';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const report = {};
const CLIP_SECONDS = {
  idle: 2,
  walk: 1,
  run: 16 / 24,
  leap: 22 / 24,
  happy: 1.5,
  excited: 1.5,
  scared: 1.25,
  sad: 1.5,
  cheer: 2.5,
};

async function open(viewport, dpr, query = '') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/hero.html?hero=${hero}&blink=0${query}`);
  await page.waitForFunction(() => window.__hero?.ready, null, { timeout: 30000 });
  return { page, ctx };
}

/** Lay PNG files out in a grid and screenshot it. */
async function sheet(files, cols, name, cell) {
  const { readFile } = await import('node:fs/promises');
  const urls = await Promise.all(
    files.map(async (f) => `data:image/png;base64,${(await readFile(f)).toString('base64')}`),
  );
  const rows = Math.ceil(urls.length / cols);
  const page = await browser.newPage({ viewport: { width: cell.w * cols, height: cell.h * rows } });
  await page.setContent(
    `<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${cell.w}px);background:#7e88bc">${urls
      .map((u) => `<img src="${u}" width="${cell.w}" height="${cell.h}">`)
      .join('')}</body>`,
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  await page.close();
}

if (what === 'shots' || what === 'all') {
  const { page, ctx } = await open({ width: 360, height: 500 }, 1);
  // turntable of idle
  const turn = [];
  for (let k = 0; k < 8; k++) {
    await page.evaluate((az) => {
      window.__hero.setCamera({ az, el: 10, dist: 3.7, target: [0, 0.72, 0] });
      window.__hero.pose('idle', 0.4, 0);
    }, k * 45);
    await page.waitForTimeout(250);
    const f = `${outDir}/turn-${k}.png`;
    await page.screenshot({ path: f });
    turn.push(f);
  }
  await sheet(turn, 4, 'turntable-idle', { w: 360, h: 500 });
  // every clip: 6 frames (walk/run 8), three-quarter view
  for (const [clip, sec] of Object.entries(CLIP_SECONDS)) {
    const n = clip === 'walk' || clip === 'run' ? 8 : 6;
    const files = [];
    for (let i = 0; i < n; i++) {
      const t =
        clip === 'walk' || clip === 'run' || clip === 'idle' || clip === 'cheer'
          ? (sec * i) / n
          : (sec * i) / (n - 1) - (i === n - 1 ? 1e-3 : 0);
      await page.evaluate(
        ([c, tt]) => {
          window.__hero.setCamera({ az: 62, el: 12, dist: 3.7, target: [0, 0.72, 0] });
          window.__hero.pose(c, tt, 0.2);
        },
        [clip, Math.max(0, t)],
      );
      await page.waitForTimeout(220);
      const f = `${outDir}/${clip}-${i}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
    await sheet(files, Math.min(4, n), `clip-${clip}`, { w: 360, h: 500 });
  }
  // side views of walk and run (the legs)
  for (const clip of ['walk', 'run']) {
    const files = [];
    const sec = CLIP_SECONDS[clip];
    for (let i = 0; i < 8; i++) {
      await page.evaluate(
        ([c, tt]) => {
          window.__hero.setCamera({ az: 0, el: 4, dist: 3.9, target: [0, 0.65, 0] });
          window.__hero.pose(c, tt, Math.PI / 2);
        },
        [clip, (sec * i) / 8],
      );
      await page.waitForTimeout(220);
      const f = `${outDir}/${clip}-side-${i}.png`;
      await page.screenshot({ path: f });
      files.push(f);
    }
    await sheet(files, 4, `side-${clip}`, { w: 360, h: 500 });
  }
  await ctx.close();
  // detail at DPR 2: face and three-quarter
  const d = await open({ width: 600, height: 700 }, 2);
  await d.page.evaluate(() => {
    window.__hero.setCamera('face');
    window.__hero.pose('idle', 0.4, 0.2);
  });
  await d.page.waitForTimeout(300);
  await d.page.screenshot({ path: `${outDir}/detail-face.png` });
  for (const e of ['happy', 'excited', 'scared', 'sad']) {
    await d.page.evaluate((em) => {
      window.__hero.setEmotion(em);
    }, e);
    await d.page.waitForTimeout(200);
    await d.page.screenshot({ path: `${outDir}/detail-face-${e}.png` });
  }
  await d.page.evaluate(() => {
    window.__hero.setEmotion('idle');
    window.__hero.setCamera({ az: 28, el: 10, dist: 3.2, target: [0, 0.75, 0] });
    window.__hero.pose('idle', 0.4, 0);
    window.__hero.setLit(true);
  });
  await d.page.waitForTimeout(300);
  await d.page.screenshot({ path: `${outDir}/detail-lit.png` });
  await d.ctx.close();
}

if (what === 'drift' || what === 'all') {
  const { page, ctx } = await open({ width: 600, height: 500 }, 1);
  report.drift = {};
  for (const gait of ['walk', 'run']) {
    const stats = await page.evaluate(() => window.__hero.stats());
    const cycle = gait === 'walk' ? stats.stride.walk : stats.stride.run;
    // straight path along +x at yaw pi/2: the planted foot must keep a constant world x while it is planted
    const steps = 96;
    const cycles = 3;
    const samples = await page.evaluate(
      ([g, cy, n, c]) => {
        const out = [];
        for (let i = 0; i <= n * c; i++) {
          const d = (cy * i) / n;
          window.__hero.walkTo(g, d, Math.PI / 2);
          out.push({ d, ...window.__hero.feet() });
        }
        return out;
      },
      [gait, cycle, steps, cycles],
    );
    // planted = the lowest foot point is on the tile; inside each such run the ankle (the foot bone) must stay put in
    // the world: its range along the path is the drift (heel-to-toe roll moves the ankle by < 0.3 design units)
    const result = {};
    for (const foot of ['L', 'R']) {
      const ys = samples.map((s) => s[foot][1]);
      const lo = Math.min(...ys);
      const thr = lo + 0.006;
      const runs = [];
      let cur = [];
      samples.forEach((s, i) => {
        if (s[foot][1] <= thr) cur.push(s['ankle' + foot][0]);
        else if (cur.length) {
          runs.push(cur);
          cur = [];
        }
        if (i === samples.length - 1 && cur.length) runs.push(cur);
      });
      const ranges = runs.filter((r) => r.length >= 6).map((r) => Math.max(...r) - Math.min(...r));
      result[foot] = { stanceWindows: ranges.length, maxRangeU: Math.max(...ranges), lowestY: lo };
    }
    report.drift[gait] = { cycleU: cycle, ...result };
  }
  await ctx.close();
}

if (what === 'fps' || what === 'all') {
  for (const clip of ['walk', 'idle']) {
    const { page, ctx } = await open({ width: 844, height: 390 }, 2, `&clip=${clip}`);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => window.__hero.setCamera('wide'));
    await page.waitForTimeout(1500);
    const samples = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      samples.push(await page.evaluate(() => window.__hero.stats().fps));
    }
    report[`fps_${clip}_4xThrottle_dpr2`] = {
      avg: +(samples.reduce((a, b) => a + b) / samples.length).toFixed(1),
      samples,
    };
    report.stats = await page.evaluate(() => window.__hero.stats());
    await ctx.close();
  }
}

await browser.close();
report.consoleErrors = errors;
await writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
