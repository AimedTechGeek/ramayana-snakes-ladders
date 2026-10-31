// Texture atlas pipeline of the living board (T42 spec sections 1.2, 3.1-3.3): rasterises SVG frames at a per-frame
// device-pixel factor on a transparent background, shelf-packs them into power-of-two PNG sheets and writes
//   <out>/<sheet>.png        the sheet
//   <out>/<sheet>.json       Phaser JSON-hash atlas (this.load.atlas(key, png, json))
//   <out>/<sheet>.meta.json  sidecar: { sheet, width, height, padding, frames: { <name>: { w, h, factor, anchorX, anchorY, ...meta } } }
// All sizes in the sidecar are FRAME pixels (device pixels of the sheet); `factor` converts logical px to frame px, so
// the sprite is drawn at scale 1/factor and the anchor becomes setOrigin(anchorX / w, anchorY / h).
//
// Usage from an art task:
//   import { buildAtlas } from './atlas.mjs';
//   await buildAtlas('props', [
//     { name: 'palm', svg, width: 20, height: 26, factor: 5, anchor: { x: 10, y: 24 }, meta: { zone: 'edge', height: 22 } },
//   ], { outDir: 'public/assets/iso', maxSize: 1024 });
// `anchor` is in the SVG's own logical px (x right, y down from its top-left), i.e. the projected world point. Several
// sheets in one build share one browser: `buildAtlases([{ sheet, frames, options }, ...])`.
// Output is deterministic: frames are ordered by height, then width, then name; JSON keys are sorted.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_OUT = 'public/assets/iso';
/** Default factors of spec 3.1: fine = max zoom 2.5 x DPR 2, coarse = follow zoom 2 x DPR 2. */
export const FACTORS = { fine: 5, coarse: 4 };

const round = (value) => Math.round(value * 1000) / 1000;
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Smallest power of two >= n (n >= 1). */
export function nextPot(n) {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Shelf packing, pure and deterministic. `items` are { name, w, h } in px (already padded). Items are placed in the
 * order height desc, width desc, name asc on shelves left to right. Tries every power-of-two sheet width up to
 * `maxSize` and keeps the one with the smallest power-of-two area (ties: narrower). Throws when nothing fits.
 * @param {{ name: string, w: number, h: number }[]} items
 * @param {number} [maxSize]
 * @returns {{ width: number, height: number, placements: Record<string, { x: number, y: number }> }}
 */
export function shelfPack(items, maxSize = 2048, minWidth = 64) {
  if (!items.length) throw new Error('shelfPack: no items');
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || byName(a, b));
  const names = new Set();
  for (const item of sorted) {
    if (names.has(item.name)) throw new Error(`shelfPack: duplicate frame name ${item.name}`);
    names.add(item.name);
    if (item.w > maxSize || item.h > maxSize) {
      throw new Error(`shelfPack: ${item.name} is ${item.w}x${item.h}, larger than maxSize ${maxSize}`);
    }
  }
  const widest = Math.max(...sorted.map((item) => item.w));
  let best = null;
  for (let width = Math.max(64, minWidth); width <= maxSize; width *= 2) {
    if (width < widest) continue;
    const placements = {};
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const item of sorted) {
      if (x + item.w > width) {
        y += shelf;
        x = 0;
        shelf = 0;
      }
      placements[item.name] = { x, y };
      x += item.w;
      shelf = Math.max(shelf, item.h);
    }
    const height = nextPot(y + shelf);
    if (height > maxSize) continue;
    if (!best || width * height < best.width * best.height) best = { width, height, placements };
  }
  if (!best)
    throw new Error(`shelfPack: ${sorted.length} frames do not fit ${maxSize}x${maxSize}; split the sheet`);
  return best;
}

/**
 * Anchor of a frame in frame pixels: logical anchor times factor plus the padding. Pure; the test pins it.
 * @param {{ x: number, y: number }} anchor logical px from the SVG's top-left
 */
export function frameAnchor(anchor, factor, padding) {
  return { x: round(anchor.x * factor + padding), y: round(anchor.y * factor + padding) };
}

function svgSource(frame) {
  if (typeof frame.svg === 'string') return frame.svg;
  if (frame.file) return readFileSync(frame.file, 'utf8');
  throw new Error(`frame ${frame.name}: give svg (string) or file`);
}

/** Logical size from the frame, else from the root tag's width/height, else from its viewBox. */
function logicalSize(frame, svg) {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const num = (attr) => {
    const m = new RegExp(`\\s${attr}="([\\d.]+)(?:px)?"`).exec(root);
    return m ? Number(m[1]) : undefined;
  };
  const box = /viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(root);
  const width = frame.width ?? num('width') ?? (box ? Number(box[1]) : undefined);
  const height = frame.height ?? num('height') ?? (box ? Number(box[2]) : undefined);
  if (!width || !height)
    throw new Error(`frame ${frame.name}: no logical width/height (pass width and height)`);
  return { width, height };
}

/** Makes sure the root tag has a viewBox of the logical size so an <img> of any CSS size scales it. */
function withViewBox(svg, width, height) {
  return svg.replace(/<svg\b[^>]*>/, (root) => {
    const stripped = root.replace(/\s(?:width|height)="[^"]*"/g, '');
    return /viewBox=/.test(stripped)
      ? stripped
      : stripped.replace('<svg', `<svg viewBox="0 0 ${width} ${height}"`);
  });
}

/**
 * A reusable headless browser. Open once per build and pass it as `options.rasteriser` to many buildAtlas calls
 * (buildAtlases does this for you). Remember to close().
 * @returns {Promise<{ page: import('playwright-core').Page, close: () => Promise<void> }>}
 */
export async function openRasteriser() {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  return { page, close: () => browser.close() };
}

/**
 * Rasterises, packs and writes one sheet.
 * @param {string} sheetName file stem and Phaser texture key suffix, e.g. 'props' or 'snakes-hard'
 * @param {{ name: string, svg?: string, file?: string, width?: number, height?: number, factor?: number,
 *   anchor?: { x: number, y: number }, meta?: Record<string, unknown> }[]} frames
 *   width/height: logical px of the SVG (default: the SVG's own width/height or viewBox); factor: device px per
 *   logical px (default options.factor); anchor: logical px from the SVG's top-left (default 0,0); meta: written
 *   verbatim into the sidecar (JSON values only).
 * @param {{ outDir?: string, maxSize?: number, factor?: number, padding?: number,
 *   rasteriser?: Awaited<ReturnType<typeof openRasteriser>> }} [options]
 *   maxSize: largest sheet side (POT, default 2048); factor: default frame factor (default FACTORS.fine);
 *   padding: transparent px around every frame so mipmaps and linear filtering do not bleed (default 2);
 *   rasteriser: a shared browser from openRasteriser (otherwise one is opened and closed for this sheet).
 * @returns {Promise<{ sheet: string, png: string, json: string, meta: string, width: number, height: number,
 *   frames: Record<string, object> }>}
 */
export async function buildAtlas(sheetName, frames, options = {}) {
  const { outDir = DEFAULT_OUT, maxSize = 2048, minWidth = 64, factor: defaultFactor = FACTORS.fine, padding = 2 } = options;
  if (!frames.length) throw new Error(`atlas ${sheetName}: no frames`);

  const prepared = frames.map((frame) => {
    const svg = svgSource(frame);
    const { width, height } = logicalSize(frame, svg);
    const factor = frame.factor ?? defaultFactor;
    if (!(factor > 0)) throw new Error(`frame ${frame.name}: bad factor ${factor}`);
    return {
      name: frame.name,
      svg: withViewBox(svg, width, height),
      width,
      height,
      factor,
      w: Math.ceil(width * factor) + 2 * padding,
      h: Math.ceil(height * factor) + 2 * padding,
      anchor: frame.anchor ?? { x: 0, y: 0 },
      meta: frame.meta ?? {},
    };
  });

  const { width: sheetW, height: sheetH, placements } = shelfPack(prepared, maxSize, minWidth);
  const owned = options.rasteriser ? null : await openRasteriser();
  const { page } = options.rasteriser ?? owned;
  const pngFile = join(outDir, `${sheetName}.png`);
  try {
    const cells = prepared
      .map((f) => {
        const { x, y } = placements[f.name];
        const src = `data:image/svg+xml;base64,${Buffer.from(f.svg).toString('base64')}`;
        return `<div style="position:absolute;left:${x}px;top:${y}px;width:${f.w}px;height:${f.h}px;overflow:hidden"><img src="${src}" style="position:absolute;left:${padding}px;top:${padding}px;width:${f.width * f.factor}px;height:${f.height * f.factor}px"></div>`;
      })
      .join('');
    await page.setViewportSize({ width: sheetW, height: sheetH });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${cells}</body></html>`,
    );
    await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())));
    mkdirSync(outDir, { recursive: true });
    await page.screenshot({
      path: pngFile,
      omitBackground: true,
      clip: { x: 0, y: 0, width: sheetW, height: sheetH },
    });
  } finally {
    if (owned) await owned.close();
  }

  const hash = {};
  const metaFrames = {};
  for (const f of [...prepared].sort(byName)) {
    const { x, y } = placements[f.name];
    hash[f.name] = {
      frame: { x, y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
    const anchor = frameAnchor(f.anchor, f.factor, padding);
    metaFrames[f.name] = {
      ...f.meta,
      w: f.w,
      h: f.h,
      factor: f.factor,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  }
  const atlas = {
    frames: hash,
    meta: {
      app: 'ramayana atlas.mjs',
      version: '1',
      image: `${sheetName}.png`,
      format: 'RGBA8888',
      size: { w: sheetW, h: sheetH },
      scale: '1',
    },
  };
  const sidecar = { sheet: sheetName, width: sheetW, height: sheetH, padding, frames: metaFrames };
  const jsonFile = join(outDir, `${sheetName}.json`);
  const metaFile = join(outDir, `${sheetName}.meta.json`);
  writeFileSync(jsonFile, `${JSON.stringify(atlas, null, 2)}\n`);
  writeFileSync(metaFile, `${JSON.stringify(sidecar, null, 2)}\n`);
  return {
    sheet: sheetName,
    png: pngFile,
    json: jsonFile,
    meta: metaFile,
    width: sheetW,
    height: sheetH,
    frames: metaFrames,
  };
}

/**
 * Builds several sheets with ONE browser instance.
 * @param {{ sheet: string, frames: Parameters<typeof buildAtlas>[1], options?: Parameters<typeof buildAtlas>[2] }[]} sheets
 */
export async function buildAtlases(sheets) {
  const rasteriser = await openRasteriser();
  try {
    const results = [];
    for (const { sheet, frames, options } of sheets) {
      results.push(await buildAtlas(sheet, frames, { ...options, rasteriser }));
    }
    return results;
  } finally {
    await rasteriser.close();
  }
}
