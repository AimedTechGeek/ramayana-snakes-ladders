// node atlas-test.mjs [out dir] (npm run art:atlas:test): builds the three-frame test sheet `atlas-test` into
// tests/fixtures/atlas. Each frame is a flat body with a pure #FF00FF 2x2 logical px marker centred on its anchor, so a
// test can find the marker in the PNG and compare it with the anchor written to the sidecar. The game loads this sheet
// in dev builds only (src/game/atlasTest.ts); it never reaches public/ or dist.
import { buildAtlas } from './atlas.mjs';

const out = process.argv[2] ?? 'tests/fixtures/atlas';
export const MARKER = '#FF00FF';

/** A w x h logical px rounded body in `fill` with the marker square centred on `anchor`. */
function dummySvg(width, height, fill, anchor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="3" fill="${fill}"/><rect x="${anchor.x - 1}" y="${anchor.y - 1}" width="2" height="2" fill="${MARKER}"/></svg>`;
}

const specs = [
  { name: 'fine-tall', width: 20, height: 26, factor: 5, anchor: { x: 10.3, y: 23.7 }, fill: '#3F6FC2' },
  { name: 'coarse-wide', width: 60, height: 47, factor: 4, anchor: { x: 30, y: 24.25 }, fill: '#2E9E6B' },
  { name: 'coarse-small', width: 24, height: 16, factor: 4, anchor: { x: 12.6, y: 8.1 }, fill: '#D15587' },
];

const started = Date.now();
const result = await buildAtlas(
  'atlas-test',
  specs.map(({ fill, ...frame }) => ({
    ...frame,
    svg: dummySvg(frame.width, frame.height, fill, frame.anchor),
    meta: { marker: MARKER, world: { note: 'dummy' } },
  })),
  { outDir: out, maxSize: 512 },
);
console.log(
  `wrote ${result.png} ${result.width}x${result.height} (${Object.keys(result.frames).length} frames, ${Date.now() - started} ms)`,
);
