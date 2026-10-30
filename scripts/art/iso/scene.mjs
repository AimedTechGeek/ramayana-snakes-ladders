// The recorded board scene shared by board.mjs (base), ladders.mjs and snakes.mjs (T40.3-T40.5).
// Every drawn item is put into one anatomy recorder together with its true shape, so A.settle can measure the
// painter's order from geometry and A.auditOrExit can prove clearance, crowding and depth order (--audit).

import * as A from '../anatomy/audit.mjs';
import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { tubePieces } from '../anatomy/tube.mjs';
import { boardProjection, camera } from '../iso-board.mjs';
import { exportSvg } from './common.mjs';

export const Z_AXIS_U = [1, 0, 0];
export const Z_AXIS_V = [0, 1, 0];

/** A vertical frame (axis +z) with its origin on the floor under (x, y); s along it is the world z. */
export const upright = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], Z_AXIS_U, Z_AXIS_V);

export function createScene() {
  const P = boardProjection();
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const R = A.recorder(P);
  const back = [];
  // solids = recorded items, marks = separate strokes, ticks, rings and dots drawn on them
  const stats = { solids: 0, tubes: 0, marks: 0 };
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => {
    stats.marks += (d.match(/M/g) ?? []).length;
    return k.lineSvg(d, style);
  };
  const Dots = (points, style) => {
    stats.marks += points.length;
    return k.dotsSvg(points, style);
  };
  const record = R.solid;

  /**
   * Put one drawn item. `symbol` names a shape that repeats exactly, only moved in the world (identical knots,
   * blocks, discs): the output draws the first one once in <defs> and every instance as a <use> translated by the
   * screen offset (the camera is parallel, so a world move is a rigid screen move).
   */
  function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
    stats.solids++;
    return R.put({ name, at: ref, where: ref, bias, svg, shapes, piece: 'board', ...rest });
  }

  /** A rounded slab; `ground` names it stand.* so the audit counts it as held by the floor. */
  function slab(name, plan, z, height, style = {}, options = {}) {
    const { steps = 3, bevel = 0, inner = '', extra = '', bias = 0, ground = false, ref, symbol } = options;
    const shape = record(A.slab(plan, z, height, { name: ground ? `stand.${name}` : name }, steps));
    const centre = ref ?? [plan.x + plan.w / 2, plan.y + plan.d / 2, z + height / 2];
    const svg = S(k.slabOf(plan, z, height, P, steps, bevel), { tone: 'mid', ...style, inner }) + extra;
    put(name, centre, svg, [shape], { bias, symbol });
    return shape;
  }

  /** Any convex or concave floor outline stood on z. */
  function prism(name, ring, z, height, style = {}, options = {}) {
    const { convex = true, bevel = 0, inner = '', extra = '', bias = 0, ref, symbol } = options;
    const shape = record(A.extruded(ring, z, height, { name }));
    const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    const svg = S(k.extrude(ring, z, height, P, { convex, bevel }), { tone: 'mid', ...style, inner }) + extra;
    put(name, ref ?? [cx, cy, z + height / 2], svg, [shape], { bias, symbol });
    return shape;
  }

  function cyl(name, cx, cy, r, z, height, style = {}, options = {}) {
    const { steps = 24, bevel = 0, inner = '', extra = '', bias = 0, ground = false, symbol } = options;
    const shape = record(A.cylinder(cx, cy, r, z, height, { name: ground ? `stand.${name}` : name }));
    const svg =
      S(k.cylinder(cx, cy, r, z, height, P, steps, bevel), { tone: 'mid', ...style, inner }) + extra;
    put(name, [cx, cy, z + height / 2], svg, [shape], { bias, symbol });
    return shape;
  }

  /** A turned part: profile closed to the axis at both ends (G.solidOf), recorded as A.solid. */
  function turned(name, F, profile, style = {}, options = {}) {
    const {
      inner = '',
      extra = '',
      bias = 0,
      smooth,
      steps,
      bevel = 0,
      ground = false,
      radius = null,
      symbol,
    } = options;
    const opts = { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(steps ? { steps } : {}) };
    const paths = G.solidOf(profile, F, P, opts);
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const shape = record(A.solid(F, profile, { name: ground ? `stand.${name}` : name, radius }));
    const svg = S(paths, { tone: 'mid', ...style, inner }) + extra;
    put(name, G.add3(F.o, G.mul3(F.a, mid)), svg, [shape], { bias, symbol });
    return shape;
  }

  /** A short cylinder along the frame axis from s0 to s1. */
  function disc(name, F, s0, s1, r, style = {}, options = {}) {
    const { inner = '', extra = '', bias = 0, steps, bevel = 0, symbol } = options;
    const paths = G.disc(s0, s1, r, F, P, { bevel, ...(steps ? { steps } : {}) });
    const shape = record(A.disc(F, s0, s1, r, { name }));
    const svg = S(paths, { tone: 'mid', ...style, inner }) + extra;
    put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), svg, [shape], { bias, symbol });
    return shape;
  }

  /** A collar: annulus of thickness s1 - s0 around the frame axis. */
  function band(name, F, s0, s1, rIn, rOut, style = {}, options = {}) {
    const { inner = '', extra = '', bias = 0, steps, owner, open = false, symbol } = options;
    // An open ring (a dais) cuts its bore into the fill at the end face; a collar around a part keeps it solid.
    const paths = G.ringBand(s0, s1, rIn, rOut, F, P, {
      ...(steps ? { steps } : {}),
      ...(open ? { hole: [s1, rIn] } : {}),
    });
    const shape = record(A.ring(F, s0, s1, rIn, rOut, { name, owner }));
    const svg = S(paths, { tone: 'mid', ...style, inner }) + extra;
    put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), svg, [shape], { bias, symbol });
    return shape;
  }

  /** A ball; small balls (a knot is one screen pixel) take fewer facets. */
  function ball(name, c, r, style = {}, options = {}) {
    const { bias = 0, extra = '', owner, symbol } = options;
    const shape = record(A.ball(c, r, { name, owner }));
    const steps = r * KS < 2.5 ? 14 : 24;
    put(name, c, S(G.sphereOf(c, r, P, { steps }), { tone: 'mid', ...style }) + extra, [shape], {
      bias,
      symbol,
    });
    return shape;
  }

  /**
   * A tube route as depth-sorted chunks (tubePieces), each recorded with its true centreline for the audit.
   * `limp` marks a body that holds nothing up (snakes, cords). `ends` says which route ends the audit checks.
   */
  function tube(name, route, radius, options = {}) {
    const {
      tone = 'mid',
      maxLength = 14,
      spacing = 1.2,
      gaps = [],
      breaks = [],
      rings,
      caps,
      limp = true,
      className,
      decorate,
      ends = [true, true],
    } = options;
    const total = G.pathLength(route);
    R.route(name, route, radius, {
      gaps,
      limp,
      ends,
      piece: 'board',
      ...(options.touch ? { touch: options.touch } : {}),
      ...(options.owner ? { owner: options.owner } : {}),
    });
    // `rings` may be one texture or a list (a snake with diamonds and bands): the pieces of every pass line up.
    const [first, ...more] = [].concat(rings ?? []);
    const shape = { maxLength, spacing, gaps, breaks, ...(caps !== undefined ? { caps } : {}) };
    const pieces = tubePieces(route, radius, P, { ...shape, ...(first ? { rings: first } : {}) });
    for (const other of more) {
      tubePieces(route, radius, P, { ...shape, rings: other }).forEach((piece, i) =>
        pieces[i].rings.push(...piece.rings),
      );
    }
    pieces.forEach((piece, index) => {
      stats.tubes++;
      const svg = tubeMarkup(piece, tone) + (decorate ? decorate(piece) : '');
      put(
        `${name}:${index}`,
        piece.mid,
        className ? `<g class="${className}">${svg}</g>` : svg,
        [A.tube(piece.points, piece.radii)],
        {
          bias: 0.05,
          route: name,
          chunk: index,
        },
      );
    });
    return { total, pieces };
  }

  /**
   * A thin line item (a string, a stem): marks drawn on the board that belong to no solid. Its true shape is a
   * hair-thin tube, so settle orders it against whatever overlaps it. `free` is the line check's end exemption and
   * `group` a class on a wrapping <g> (the ink classes colour their descendants).
   */
  function line(name, points, style = {}, options = {}) {
    const { radius = 0.25, free, bias = 0.02, group } = options;
    const d = k.pathOf(points.map(at));
    stats.marks++;
    const mid = points[Math.floor(points.length / 2)];
    const svg = k.lineSvg(d, { tone: 'mid', ...style, free });
    put(name, mid, group ? `<g class="${group}">${svg}</g>` : svg, [A.tube(points, radius)], { bias });
  }

  const layers = [];
  const sharedDefs = [];

  /**
   * Mark the recorded solids named `prefix*` as held by what they ride on (a collar on a snake's body, a crest on its
   * head): the body is a limp tube that holds nothing up in the audit's contact graph, so its riders say so here.
   */
  function hold(...prefixes) {
    for (const shape of R.solids)
      if (prefixes.some((p) => (shape.name ?? '').startsWith(p))) shape.ground = true;
  }
  const crowd = [];

  /** Name patterns of two lines that meet on purpose (a rung ending on a knot beside its rail): crowding excused. */
  function allowCrowd(a, b) {
    crowd.push([a, b]);
  }

  /** Markup for <defs> (a shape that a merged layer draws many times with <use>). */
  function addDef(svg) {
    sharedDefs.push(svg);
  }

  /**
   * Draw the items named `prefix*` as one merged markup block placed right after the item `after` (the items stay
   * recorded one by one, so settle and audit still see every shape). For a dense set that never overlaps itself
   * (the 144 tiles): shared paths instead of 144 groups.
   */
  function mergeLayer(prefix, after, svg) {
    layers.push({ prefix, after, svg });
  }

  /**
   * The markup of the sorted items: merged layers out, symbol instances as <use>, the rest as they are. The stand
   * (plinth, flanges, field, rim bars) comes first in its settled order; everything else stands on it, so it follows
   * in its settled order. That keeps a thin mark, which settle cannot rank against a layer, above the tiles.
   */
  function drawnItems(debug) {
    const defs = new Map();
    const out = [];
    const wrap = (item, svg) => (debug ? `<g data-name="${item.name}">${svg}</g>` : svg);
    const onStand = (item) => item.shapes.some((shape) => (shape.name ?? '').startsWith('stand.'));
    const ordered = [...R.items.filter(onStand), ...R.items.filter((item) => !onStand(item))];
    for (const item of ordered) {
      if (layers.some((layer) => item.name.startsWith(layer.prefix))) continue;
      let svg = item.svg;
      if (item.symbol) {
        let def = defs.get(item.symbol);
        if (!def) {
          def = { id: `s${defs.size}`, svg, origin: at(item.where) };
          defs.set(item.symbol, def);
        }
        const [x, y] = at(item.where);
        const move = `${num(x - def.origin[0])} ${num(y - def.origin[1])}`;
        svg = `<use href="#${def.id}"${move === '0 0' ? '' : ` transform="translate(${move})"`}/>`;
      }
      out.push(wrap(item, svg));
      for (const layer of layers) if (layer.after === item.name) out.push(layer.svg);
    }
    const definitions =
      sharedDefs.join('') + [...defs.values()].map((def) => `<g id="${def.id}">${def.svg}</g>`).join('');
    return definitions ? [`<defs>${definitions}</defs>`, ...out] : out;
  }

  /** Settle the painter's keys from geometry, sort, and wrap into a standalone light SVG. */
  function finish({ label, audit = false, debug = false }) {
    A.settle(R, P);
    R.items.sort((a, b) => a.key - b.key);
    const { width, height } = boardProjectionFrame();
    const body = `<g transform="scale(.1)">${[...back, ...drawnItems(debug)].join('')}</g>`;
    const svg = pruneCss(tenfold(exportSvg({ width, height, label, body })));
    if (audit) A.auditOrExit(R, P, { argv: ['--audit'], crowd });
    return svg;
  }

  return {
    P,
    V,
    KS,
    R,
    back,
    stats,
    at,
    S,
    Ln,
    Dots,
    record,
    put,
    slab,
    prism,
    cyl,
    turned,
    disc,
    band,
    ball,
    tube,
    line,
    mergeLayer,
    addDef,
    hold,
    allowCrowd,
    finish,
  };
}

/** The board SVG's pixel frame is the camera rect, so image pixel (0, 0) is stage pixel (0, 0) (offset 0, 0). */
export function boardProjectionFrame() {
  return { width: camera.rect.width, height: camera.rect.height };
}

/** The ring texture opacity levels: the kit's twenty collapse to three, and a run of equal-level segments is one line. */
const RING_LEVELS = 2;

function ringPaths(rings) {
  const groups = new Map();
  let run = null;
  for (const { d, alpha } of rings) {
    const level = Math.round(alpha * RING_LEVELS) / RING_LEVELS;
    if (level <= 0) continue;
    const [, from, to] = /^M([^L]+)L(.+)$/.exec(d);
    if (run && run.level === level && run.end === from) {
      run.d += `L${to}`;
      run.end = to;
    } else {
      if (run) groups.set(run.level, (groups.get(run.level) ?? '') + run.d);
      run = { level, end: to, d: d };
    }
  }
  if (run) groups.set(run.level, (groups.get(run.level) ?? '') + run.d);
  return groups;
}

/**
 * One tube chunk as markup, like the kit's tubeSvg but with the ring texture in three opacity levels and joined
 * into runs (the kit draws twenty levels, one path per segment): the same look at a fraction of the bytes.
 */
function tubeMarkup(piece, tone) {
  const shine = piece.wide
    ? `<path class="tb-shine" d="${piece.shine}"/><path class="tb-shade" d="${piece.shade}"/>`
    : '';
  const rings = [...ringPaths(piece.rings ?? [])]
    .map(
      ([alpha, d]) =>
        `<path class="tb-ring" data-tone="${piece.ringTone}" d="${d}"${alpha < 1 ? ` opacity="${Math.round(alpha * 100) / 100}"` : ''}/>`,
    )
    .join('');
  return `<g class="tb"><path class="tb-body" d="${piece.body}"/>${shine}${rings}<path class="iso-line tb-edge" data-tone="${tone}" d="${piece.edges}"/></g>`;
}

const NUMBER = /-?\d*\.?\d+/g;
const round1 = (v) => Math.round(v * 10) / 10;

function num(v) {
  const text = round1(v).toString();
  return text === '-0' ? '0' : text.replace(/^(-?)0\./, '$1.');
}

function joinNumbers(values) {
  let out = '';
  for (const v of values) {
    const text = num(v);
    out += (out && !text.startsWith('-') ? ' ' : '') + text;
  }
  return out;
}

/**
 * Rewrite every M/L/Z path (the kit's pathOf output, all coordinates already on a 0.1 grid) with relative line
 * segments: the same shape, about a third shorter. Paths with any other command are left alone.
 */
export function compactPaths(svg) {
  return svg.replace(/ d="([MLZ0-9 .-]*)"/g, (whole, d) => {
    let out = '';
    for (const part of d.split('M').slice(1)) {
      const closed = part.endsWith('Z');
      const points = part
        .replace(/Z$/, '')
        .split('L')
        .map((pair) => pair.match(NUMBER).map(Number));
      out += `M${joinNumbers(points[0])}`;
      const deltas = [];
      for (let i = 1; i < points.length; i++) {
        deltas.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      }
      if (deltas.length) out += `l${joinNumbers(deltas)}`;
      if (closed) out += 'Z';
    }
    return ` d="${out}"`;
  });
}

/** Drop the ink, rail, rung and seat class rules that no element of this board uses, and kit rules no board needs. */
const UNUSED_CSS = [
  '.iso-wire',
  '.iso-face-text',
  '.iso-line[data-tone="red"]',
  '.iso-line[data-tone="green"]',
  '.iso-line[data-tone="blue"]',
  '.iso-line[data-tone="lit"]',
  '.iso-line[data-dotted]',
  '.iso-line[data-dashed]',
  '.iso-line[data-flow]',
  '.iso-dots circle[data-pulse]',
  '.iso-solid[data-lit]',
];

function pruneCss(svg) {
  const end = svg.indexOf('</style>');
  const body = svg.slice(end);
  const kept = svg
    .slice(0, end)
    .split('\n')
    .filter((rule) => {
      const m = /^\.(ink|hink|rail|rung|seat)-([\w-]+)[ {]/.exec(rule);
      if (UNUSED_CSS.some((prefix) => rule.startsWith(prefix))) return false;
      return !m || new RegExp(`class="[^"]*\\b${m[1]}-${m[2]}(?![\\w-])`).test(body);
    });
  return kept.join('\n') + body;
}

/** The stroke, blur and offset rules of the kit that are written in user units: tenfold, since the drawing is. */
const TENFOLD_CSS = [
  '.iso{--anatomy-weight:6px}',
  '.tb-ring{stroke-width:4.5}',
  '.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:4}',
  '.iso-numeral{stroke-width:9}',
  '.iso-halo{filter:blur(90px);transform:translateY(30px)}',
].join('\n');

const times10 = (v) => num(Number(v) * 10);

/** One M/L/Z path in tenths: the first point absolute, then every step relative, all whole numbers. */
function tenthsPath(d) {
  let out = '';
  for (const part of d.split('M').slice(1)) {
    const closed = part.endsWith('Z');
    const points = part
      .replace(/Z$/, '')
      .split('L')
      .map((pair) => pair.match(NUMBER).map((v) => Math.round(Number(v) * 10)));
    out += `M${points[0].join(' ')}`;
    const steps = [];
    for (let i = 1; i < points.length; i++)
      steps.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (steps.length) out += `l${steps.map((v, i) => (i && v >= 0 ? ` ${v}` : String(v))).join('')}`;
    if (closed) out += 'Z';
  }
  return out;
}

/**
 * The drawing's coordinates are all on a 0.1 grid, so every number becomes a whole number of tenths, relative paths
 * and all, and the drawing sits in a scale(.1) group: a fifth shorter than decimals. The stroke widths and the halo's
 * blur in the CSS (user units) are written tenfold to match; dots and <use> offsets are scaled with the paths.
 */
function tenfold(svg) {
  const cut = svg.indexOf('</style>');
  const body = svg
    .slice(cut)
    .replace(/ d="([MLZ0-9 .-]*)"/g, (whole, d) => ` d="${tenthsPath(d)}"`)
    .replace(/<(circle|use)\b[^>]*>/g, (tag) =>
      tag
        .replace(/\b(cx|cy|r|x|y)="(-?[\d.]+)"/g, (whole, name, v) => `${name}="${times10(v)}"`)
        .replace(
          /translate\(([^)]*)\)/,
          (whole, v) => `translate(${v.trim().split(/[ ,]+/).map(times10).join(' ')})`,
        ),
    );
  return `${svg.slice(0, cut)}${TENFOLD_CSS}\n${body}`;
}
