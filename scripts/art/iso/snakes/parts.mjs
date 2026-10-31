// Building blocks shared by the model and the motifs: smooth sweeps as depth-sortable items, coloured classes, prisms.
import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { local } from '../figurines/common.mjs';
import { chunkSvg, chunksOf, makeSweep, marksFor, paintOf, uid } from './sweep.mjs';

/** Add the smooth tube of a sweep as depth-sortable items. `spriteOf(piece)` names the sprite of each chunk. */
export function addSweep(fig, { owner, name, sweep, paint, patterns = [], maxLength = 6, breaks = [], gaps = [], caps = true, spriteOf, extras, bias = 0, touch, ends }) {
  const id = fig.R.nameFor(name);
  fig.R.route(id, sweep.route, (u) => sweep.radiusAt(u), { owner, piece: owner, gaps, touch, ...(ends ? { ends } : {}) });
  const pieces = chunksOf(sweep, { maxLength, breaks, gaps, caps });
  pieces.forEach((piece, index) => {
    const marks = patterns.map((p) => marksFor(sweep, paint, p, piece.from, piece.to)).join('');
    const more = extras ? extras(piece, index) : { inside: '', after: '' };
    let svg = chunkSvg(sweep, paint, piece, marks + more.inside);
    if (more.clip && !process.env.NOCLIP) {
      const clip = uid('c');
      svg = `<clipPath id="${clip}"><path d="${more.clip}"/></clipPath><g clip-path="url(#${clip})">${svg}</g>`;
    }
    const item = fig.R.put({
      piece: owner,
      at: piece.mid,
      bias,
      svg: (more.before ?? '') + svg + (more.after ?? ''),
      shapes: [A.tube(piece.points, piece.radii, { name: `${id}:${index}`, owner })],
      name: `${id}:${index}`,
      route: id,
      chunk: index,
    });
    item.sprite = spriteOf(piece, index);
  });
  fig.parts.add(name);
  return { id, pieces };
}


/** The class that carries the four tones and the line tone of a hex, registered on the figure for the CSS pass. */
export function colourClass(fig, hex) {
  fig.colours ??= new Set();
  fig.colours.add(hex);
  return `pc-${hex.slice(1)}`;
}


/**
 * A smooth round tube along `route` (world points) with radius `radius` (number or u => r), coloured `hex`, as items.
 * `sprite`: 'head' or 'coil'.
 */
export function addTube(fig, { owner = 'body', name, route, radius, hex, sprite, caps = true, down }) {
  const sweep = makeSweep(route, radius, fig.P, down ? { down } : {});
  return addSweep(fig, { owner, name, sweep, paint: paintOf(hex), maxLength: 40, caps, ends: [false, false], spriteOf: () => sprite });
}

/** A prism of a local (right, forward) polygon from `z0` up `height`, standing on the local point `at`. */
export function addPrism(fig, { owner = 'prop', name, at, polygon, z0 = 0, height, hex, tone = 'hi', meta = {}, axisUp = true, frame }) {
  const origin = local([at[0], at[1], 0]);
  const F = frame ?? G.frameOf(origin, [0, 0, 1], local([1, 0, 0]), local([0, 1, 0]));
  void axisUp;
  const paths = G.prismOf(F, polygon, z0, z0 + height, fig.P);
  const shape = fig.R.solid(A.prism(F, polygon, z0, z0 + height, { name: `${name}.shape`, owner, ...(owner === 'prop' ? { ground: true } : {}), ...meta }));
  const centre = G.add3(F.o, G.mul3(F.a, z0 + height / 2));
  fig.put(owner, name, centre, k.solidSvg(paths, { tone, className: colourClass(fig, hex) }), { shapes: [shape] });
}

/** A turned part (lathe) on frame F, coloured hex. */
export function addTurned(fig, { owner = 'prop', name, F, profile, hex, tone = 'hi', meta, smooth }) {
  return fig.turned(owner, name, F, profile, { tone, className: colourClass(fig, hex), meta: { ...(owner === 'prop' ? { ground: true } : {}), ...meta }, smooth });
}

/** A ring band on frame F, coloured hex. */
export function addRing(fig, { owner = 'prop', name, F, s0, s1, rIn, rOut, hex, tone = 'hi', meta, steps }) {
  void steps;
  return fig.ring(owner, name, F, s0, s1, rIn, rOut, { tone, className: `${colourClass(fig, hex)} open`, meta: { ...(owner === 'prop' ? { ground: true } : {}), ...meta } });
}
