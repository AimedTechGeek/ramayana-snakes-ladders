// Encodes picked review PNGs to WebP for the review document.
//   node scripts/review/webp.mjs <pngDir> <imagesDir> [name,name,...] [quality=0.8]
// Without names every PNG in <pngDir> is encoded.
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, toWebp } from './lib.mjs';

const [src, dst, names, quality = '0.8'] = process.argv.slice(2);
if (!src || !dst) {
  console.error('usage: node scripts/review/webp.mjs <pngDir> <imagesDir> [name,name,...] [quality]');
  process.exit(2);
}
let from = src;
if (names) {
  // stage only the picks so toWebp sees just them
  from = join(tmpdir(), `review-webp-${process.pid}`);
  await rm(from, { recursive: true, force: true });
  await mkdir(from, { recursive: true });
  for (const name of names.split(',')) await copyFile(join(src, `${name}.png`), join(from, `${name}.png`));
}
const browser = await launch();
const total = await toWebp(browser, from, dst, Number(quality));
await browser.close();
if (from !== src) await rm(from, { recursive: true, force: true });
console.log(`${(await readdir(dst)).length} images, ${(total / 1024 / 1024).toFixed(2)} MB`);
