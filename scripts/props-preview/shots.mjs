// Screenshots of the scenery preview (needs `npx vite --port 5199` running): node scripts/props-preview/shots.mjs <outDir> [names...]
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const PORT = process.env.PREVIEW_PORT ?? 5199;
const BASE = `http://localhost:${PORT}/scripts/props-preview/index.html`;
const out = process.argv[2];
const only = process.argv.slice(3);
await mkdir(out, { recursive: true });

const SHEETS = Object.fromEntries(
  ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'].flatMap((region) =>
    [0, 1.6, 3.2, 4.7].map((spin, i) => [
      `sheet-${region}-${i}`,
      `mode=sheet&region=${region}&spin=${spin}&tx=0.8&tz=-5&ty=0.1&dist=${region === 'mithila' ? 6.6 : 6.4}&polar=0.95&az=0&scale=2.6`,
    ]),
  ),
);
const SHOTS = {
  ...SHEETS,
  gate: 'tx=-5.5&tz=5.9&ty=0.3&dist=2.1&polar=1.05&az=0.3',
  coronation: 'tx=-5.5&tz=-5.6&ty=0.3&dist=2.6&polar=0.95&az=0.5',
  'coronation-front': 'tx=-5.5&tz=-5.4&ty=0.4&dist=3.2&polar=1.15&az=0',
  palace: 'tx=-4.6&tz=3.6&ty=0.3&dist=2.4&polar=1.0&az=0.7',
  'board-fit': 'tx=0&tz=0&ty=0&dist=19&polar=0.8&az=0',
  'board-close-mithila': 'tx=-3&tz=4&ty=0&dist=5.2&polar=0.95&az=0.4',
  'board-close-dandaka': 'tx=1&tz=-0.5&ty=0&dist=5.2&polar=0.95&az=-0.4',
  'board-close-kish': 'tx=2&tz=-3&ty=0&dist=5.2&polar=0.95&az=0.3',
  'board-close-sea': 'tx=0&tz=-3.5&ty=0&dist=5.2&polar=0.95&az=0',
  'board-close-lanka': 'tx=-2&tz=-5&ty=0&dist=5.4&polar=0.95&az=0.2',
  'board-close-ganga': 'tx=-1&tz=-0.5&ty=0&dist=5&polar=0.95&az=0',
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
page.on('pageerror', (e) => console.error('pageerror:', e.message));
for (const [name, query] of Object.entries(SHOTS)) {
  if (only.length && !only.some((o) => name.startsWith(o))) continue;
  await page.goto(`${BASE}?${query.startsWith('mode') ? query : 'mode=board&' + query}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90_000 });
  await page.waitForTimeout(400);
  const info = await page.evaluate('window.__info()');
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(info));
}
await browser.close();
