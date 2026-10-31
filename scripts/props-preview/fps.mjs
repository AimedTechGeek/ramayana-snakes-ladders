// fps of the full board with every prop at 844x390, 4x CPU throttle (needs `npx vite --port 5199`).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1.5 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await page.goto('http://localhost:5199/scripts/props-preview/index.html?mode=board&dist=19&polar=0.8&dpr=1.5');
await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 > 4000) resolve((n * 1000) / (performance.now() - t0)); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
console.log('fps', fps.toFixed(1), JSON.stringify(await page.evaluate('window.__info()')));
await browser.close();
