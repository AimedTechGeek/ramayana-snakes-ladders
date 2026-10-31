// node props.mjs [--out dir] [--only kind,kind] [--svg-dir dir] (npm run art:props): the region props atlas of the living
// board (T42 spec sections 1.3, 1.5, 1.6, 2, 3 and task T42.3). Draws every prop kind with the board camera on a tile top,
// checks it against its zone from the recorded geometry, rasterises at the fine factor and writes
//   public/assets/iso/props.png / props.json / props.meta.json
// Meta per frame (frame name = kind id): kind, regions[], zone ('side' | 'back' | 'centre'), height (world units above the
// tile top), footprint { w, d } (world units), parts (solid parts), anim ('sway' | 'flicker' | 'smoke' | 'shimmer' |
// 'none'), baseZ (TOP_Z: the prop stands on the tile top), variety (in the region's random list), landmark, squares[] (fixed squares of spec 1.5), emit
// { x, y } (smoke origin in logical px from the anchor); atlas.mjs adds w, h, factor, anchorX, anchorY.
//   --svg-dir writes each prop as a standalone SVG (for scripts/art/iso/check.mjs, the line-end check).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAtlas, FACTORS } from './atlas.mjs';
import { k, P } from './props/kit.mjs';
import { KINDS } from './props/kinds.mjs';
import { TOP_Z } from './world.mjs';

export const ANIMS = ['sway', 'flicker', 'smoke', 'shimmer', 'none'];
export const ZONES = ['side', 'back', 'centre'];
/** Limits per zone from spec 1.3: side strips 10 x 38 (props 12 wide, long landmarks up to 38 deep), back strip 32 x 6. */
export const ZONE_LIMITS = {
  side: { height: 22, width: 12, depth: 38 },
  back: { height: 12, width: 10, depth: 6 },
  centre: { height: 0.4, width: 32, depth: 32 },
};
const EPSILON = 1e-6;
const round1 = (v) => Math.round(v * 10) / 10;

/** Draws one kind; returns { svg, width, height, anchor, meta } after enforcing the zone limits. */
export function drawKind(def) {
  const drawn = def.draw();
  const { stats } = drawn;
  const height = stats.z1;
  const footprint = { w: round1(stats.x1 - stats.x0), d: round1(stats.y1 - stats.y0) };
  const limits = ZONE_LIMITS[def.zone];
  const problems = [];
  if (!limits) problems.push(`unknown zone ${def.zone}`);
  if (!ANIMS.includes(def.anim)) problems.push(`unknown anim ${def.anim}`);
  if (Math.abs(stats.z0) > EPSILON) problems.push(`base at z ${stats.z0}, not the tile top`);
  if (stats.parts < 4) problems.push(`only ${stats.parts} solid parts`);
  if (limits) {
    if (height > limits.height + EPSILON) problems.push(`height ${round1(height)} > ${limits.height}`);
    if (footprint.w > limits.width + EPSILON) problems.push(`width ${footprint.w} > ${limits.width}`);
    if (footprint.d > limits.depth + EPSILON) problems.push(`depth ${footprint.d} > ${limits.depth}`);
  }
  const expected = height <= ZONE_LIMITS.back.height ? 'back' : 'side';
  if (def.variety && def.zone !== 'centre' && def.zone !== expected)
    problems.push('random kind of height ' + round1(height) + ' must be zone ' + expected + ' (spec 1.3)');
  if (typeof def.variety !== 'boolean') problems.push('variety flag missing');
  if (problems.length) throw new Error(`prop ${def.kind}: ${problems.join('; ')}`);
  const [ox, oy] = k.iso([0, 0, TOP_Z], P);
  const meta = {
    kind: def.kind,
    regions: def.regions,
    zone: def.zone,
    height: round1(height),
    footprint,
    parts: stats.parts,
    anim: def.anim,
    baseZ: TOP_Z,
    variety: def.variety,
    landmark: Boolean(def.squares),
    ...(def.squares ? { squares: def.squares } : {}),
  };
  if (def.emit) {
    const [ex, ey] = k.iso([def.emit[0], def.emit[1], TOP_Z + def.emit[2]], P);
    meta.emit = { x: round1(ex - ox), y: round1(ey - oy) };
  }
  return { ...drawn, meta };
}

export async function buildProps({ outDir = 'public/assets/iso', only = null, svgDir = null } = {}) {
  const defs = only ? KINDS.filter((d) => only.includes(d.kind)) : KINDS;
  const names = new Set();
  const failures = [];
  const frames = defs.flatMap((def) => {
    if (names.has(def.kind)) throw new Error(`duplicate prop kind ${def.kind}`);
    names.add(def.kind);
    let drawn;
    try {
      drawn = drawKind(def);
    } catch (error) {
      failures.push(error.message);
      return [];
    }
    if (svgDir) {
      mkdirSync(svgDir, { recursive: true });
      writeFileSync(join(svgDir, `${def.kind}.svg`), `${drawn.svg}\n`);
    }
    return [
      {
        name: def.kind,
        svg: drawn.svg,
        width: drawn.width,
        height: drawn.height,
        factor: FACTORS.fine,
        anchor: drawn.anchor,
        meta: drawn.meta,
      },
    ];
  });
  if (failures.length) throw new Error(failures.join(String.fromCharCode(10)));
  return buildAtlas('props', frames, { outDir, maxSize: 1024 });
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  const args = process.argv.slice(2);
  const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  const only = value('--only');
  const started = Date.now();
  const result = await buildProps({
    outDir: value('--out') ?? 'public/assets/iso',
    only: only ? only.split(',') : null,
    svgDir: value('--svg-dir'),
  });
  console.log(
    `wrote ${result.png} ${result.width}x${result.height} (${Object.keys(result.frames).length} props, ${Date.now() - started} ms)`,
  );
}
