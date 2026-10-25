// node sheet.mjs <project root>: writes screenshots-tmp/t23-sheet.html and renders it with Edge headless to t23-sheet.png.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const proj = resolve(process.argv[2]);
const require = createRequire(join(proj, 'package.json'));
const { chromium } = require('playwright-core');

const A = '../public/assets';
const snakes = [
  'tataka',
  'manthara',
  'kaikeyi',
  'viradha',
  'shurpanakha',
  'golden-deer',
  'abduction',
  'kabandha',
  'indrajit-arrows',
  'prahasta',
  'kumbhakarna',
  'brahmastra',
  'ravana',
];
const heroes = ['rama', 'sita', 'lakshmana', 'hanuman'];

// Simulated square numbers (14px bold on a 22x16 parchment chip, 4px inset) and a few tokens, as the game would draw them.
let chips = '';
for (let n = 1; n <= 144; n++) {
  const row = Math.floor((n - 1) / 12),
    off = (n - 1) % 12;
  const col = row % 2 === 0 ? off : 11 - off;
  const x = col * 56 + 4,
    y = 672 - (row + 1) * 56 + 4;
  chips += `<div class="chip" style="left:${x}px;top:${y}px">${n}</div>`;
}
const tokenAt = (hero, n, dx = 0, dy = 0) => {
  const row = Math.floor((n - 1) / 12),
    off = (n - 1) % 12;
  const col = row % 2 === 0 ? off : 11 - off;
  const x = col * 56 + 28 + dx - 20,
    y = 672 - row * 56 - 28 + dy - 20;
  return `<img class="tok" src="${A}/tokens/${hero}.svg" style="left:${x}px;top:${y}px">`;
};
const tokens =
  tokenAt('rama', 1) +
  tokenAt('sita', 30, -10, -10) +
  tokenAt('lakshmana', 30, 10, -10) +
  tokenAt('hanuman', 30, 0, 10) +
  tokenAt('hanuman', 67) +
  tokenAt('rama', 99, -10, 0) +
  tokenAt('sita', 99, 10, 0) +
  tokenAt('lakshmana', 115) +
  tokenAt('rama', 140);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#1b1a3a;font:12px/1.4 system-ui;color:#F3E3B8;padding:12px}
.board{position:relative;width:672px;height:672px;float:left;margin-right:16px}
.board img.bg{position:absolute;left:0;top:0;width:672px;height:672px}
.chip{position:absolute;width:22px;height:16px;background:rgba(243,227,184,.55);color:#2A1A0F;font:700 12px/16px "Nunito",system-ui;text-align:center;border-radius:2px}
.tok{position:absolute;width:40px;height:40px}
.side{float:left;width:640px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;margin-bottom:8px}
.row img{background:#4C8C3F}
.lbl{width:100%;margin:4px 0 0;color:#E9C12F}
.light img{background:#F3E3B8}
</style></head><body>
<div class="board"><img class="bg" src="${A}/board/background.svg">${chips}${tokens}</div>
<div class="side">
<div class="lbl">tokens @96 / @40 (on green) and @40 on parchment</div>
<div class="row">${heroes.map((h) => `<img src="${A}/tokens/${h}.svg" width="96" height="96">`).join('')}${heroes.map((h) => `<img src="${A}/tokens/${h}.svg" width="40" height="40">`).join('')}<span class="light">${heroes.map((h) => `<img src="${A}/tokens/${h}.svg" width="40" height="40">`).join('')}</span></div>
<div class="lbl">snake heads @96</div>
<div class="row">${snakes.map((s) => `<img src="${A}/snakes/${s}.svg" width="96" height="96" title="${s}">`).join('')}</div>
<div class="lbl">snake heads @48 on parchment</div>
<div class="row light">${snakes.map((s) => `<img src="${A}/snakes/${s}.svg" width="48" height="48">`).join('')}</div>
<div class="lbl">favicon @64 @32 @16</div>
<div class="row"><img src="${A}/icons/favicon.svg" width="64" height="64"><img src="${A}/icons/favicon.svg" width="32" height="32"><img src="${A}/icons/favicon.svg" width="16" height="16"></div>
</div></body></html>`;

const dir = join(proj, 'screenshots-tmp');
mkdirSync(dir, { recursive: true });
const htmlPath = join(dir, 't23-sheet.html');
writeFileSync(htmlPath, html);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 700 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(dir, 't23-sheet.png'), fullPage: true });
// 2x zoom crops of the board for a closer look
const page2 = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 2 });
await page2.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
await page2.waitForTimeout(300);
await page2.screenshot({
  path: join(dir, 't23-board-top.png'),
  clip: { x: 12, y: 12, width: 672, height: 336 },
});
await page2.screenshot({
  path: join(dir, 't23-board-bottom.png'),
  clip: { x: 12, y: 348, width: 672, height: 336 },
});
await browser.close();
console.log(errors.length ? 'console errors:\n' + errors.join('\n') : 'rendered ok');
