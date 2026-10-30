// node raster.mjs [source dir] [out dir] (run by npm run art:iso after build.mjs): rasterises every figurine SVG of
// art-src/iso/fig at its display size x SCALE with a transparent background into public/assets/iso/fig/*.png, and writes
// public/assets/iso/figurines.json for the runtime: { w, h } are PNG pixels, anchorX/anchorY the feet point in PNG pixels,
// scale = SCALE (Phaser draws the texture at 1/scale), k = display px per world unit. The SVGs stay out of public/ so dist
// carries 120 small PNGs instead of 6.7 MB of SVG per hero (T40 spec section 8).
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { writeManifest } from './common.mjs';

export const SCALE = 2;
const source = process.argv[2] ?? 'art-src/iso';
const out = process.argv[3] ?? 'public/assets/iso';

const round = (value) => Math.round(value * 1000) / 1000;
const manifest = JSON.parse(readFileSync(join(source, 'figurines.json'), 'utf8'));
const files = readdirSync(join(source, 'fig')).filter((name) => name.endsWith('.svg'));
if (!files.length) throw new Error(`no figurine SVGs under ${join(source, 'fig')}`);
mkdirSync(join(out, 'fig'), { recursive: true });

const runtime = {};
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ deviceScaleFactor: SCALE });
  const page = await context.newPage();
  for (const file of files) {
    const name = file.replace(/\.svg$/, '');
    const [hero, emotion, ...rest] = name.split('-');
    const size = rest.pop();
    const variant = rest[0] === 'lit' ? 'lit' : 'plain';
    const entry = manifest[`${hero}.${emotion}.${variant}.${size}`];
    if (!entry) throw new Error(`${file} has no manifest entry`);
    const svg = readFileSync(join(source, 'fig', file), 'utf8');
    await page.setViewportSize({ width: entry.w, height: entry.h });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${entry.w}px;height:${entry.h}px">${svg.replace('<svg ', `<svg width="${entry.w}" height="${entry.h}" style="display:block" `)}</div></body></html>`,
    );
    await page.screenshot({
      path: join(out, 'fig', `${name}.png`),
      omitBackground: true,
      clip: { x: 0, y: 0, width: entry.w, height: entry.h },
    });
    runtime[`${hero}.${emotion}.${variant}.${size}`] = {
      w: entry.w * SCALE,
      h: entry.h * SCALE,
      anchorX: round(entry.anchorX * SCALE),
      anchorY: round(entry.anchorY * SCALE),
      scale: SCALE,
      k: entry.k,
    };
  }
} finally {
  await browser.close();
}
writeManifest(join(out, 'figurines.json'), runtime);
console.log(`wrote ${files.length} figurine PNGs (x${SCALE}) and figurines.json under ${out}`);
