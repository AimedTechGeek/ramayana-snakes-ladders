// The 13 clay snake GLBs against T44 5 (decoded from the built files, skinned in every clip): budgets, the 5.5
// RESPECT rules, the footprint (a snake never leaves its head block, so nothing runs between head and tail), the head
// heights, and clearance from the bridges' decks.
import { readFileSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AnimationMixer, SkinnedMesh, Vector3, type AnimationClip, type Group } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { boardFor } from '../src/core/boards';
import { BRIDGE_PAIRS, buildBridge, DECK_WIDTH, PARAPET_WIDTH } from '../src/app/board3d/bridgeGeometry';
import {
  ANCHOR_BACK,
  SNAKE_META,
  clipSeconds,
  snakeAnchor,
  type SnakeClip,
  type SnakeMeta,
} from '../src/app/board3d/snakeChoreo';

const IDS = Object.keys(SNAKE_META);
const HARD_SNAKES = boardFor('hard').snakes;
const CLIPS_SAMPLED: [SnakeClip, number][] = [
  ['rise', 0.5],
  ['rise', 1],
  ['idle', 0],
  ['idle', 0.25],
  ['idle', 0.5],
  ['idle', 0.75],
  ['hold', 1],
  ['strike', 0.5],
  ['strike', 1],
  ['swallow', 0.5],
  ['swallow', 1],
  ['settle', 0.5],
  ['settle', 1],
];

interface Loaded {
  scene: Group;
  clips: AnimationClip[];
  body: SkinnedMesh;
  mixer: AnimationMixer;
  file: Uint8Array;
  json: {
    nodes: { name?: string }[];
    skins: { joints: number[] }[];
    materials: { name: string }[];
    meshes: { name?: string }[];
  };
}
const cache = new Map<string, Promise<Loaded>>();

function load(id: string): Promise<Loaded> {
  let entry = cache.get(id);
  if (!entry) {
    entry = (async () => {
      const file = readFileSync(`public/models/snakes/${id}.glb`);
      const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
      const jsonLength = view.getUint32(12, true);
      const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength))) as Loaded['json'];
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.parseAsync(file.slice().buffer as ArrayBuffer, '');
      let body: SkinnedMesh | null = null;
      gltf.scene.traverse((o) => {
        if ((o as SkinnedMesh).isSkinnedMesh) body = o as SkinnedMesh;
      });
      return { scene: gltf.scene, clips: gltf.animations, body: body!, mixer: new AnimationMixer(gltf.scene), file, json };
    })();
    cache.set(id, entry);
  }
  return entry;
}

/** Skinned vertices (board units, relative to the coil centre) with `clip` at progress `u` of its beat. */
function posed(l: Loaded, id: string, clip: SnakeClip, u: number): Vector3[] {
  const meta = SNAKE_META[id]!;
  l.mixer.stopAllAction();
  const action = l.mixer.clipAction(l.clips.find((c) => c.name === clip)!);
  action.reset().play();
  action.setEffectiveTimeScale(0);
  action.time = clipSeconds(meta, clip, u);
  l.mixer.update(0);
  l.scene.updateMatrixWorld(true);
  l.body.skeleton.update();
  const out: Vector3[] = [];
  const position = l.body.geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const v = new Vector3();
    l.body.getVertexPosition(i, v);
    out.push(v.applyMatrix4(l.body.matrixWorld));
  }
  return out;
}

const radiusOf = (m: SnakeMeta): number => (m.R_du as number) / 56;

describe('Snake GLBs: budgets (T44 5.2, 10)', () => {
  it.each(IDS)('Snake_(%s)_ShouldStayInTheTriangleByteAndDrawCallBudget', async (id) => {
    const l = await load(id);
    const meta = SNAKE_META[id]!;
    expect(meta.triangles).toBeLessThanOrEqual(id === 'ravana' ? 3200 : 2200);
    expect(brotliCompressSync(l.file).length).toBeLessThanOrEqual((id === 'ravana' ? 110 : 70) * 1024);
    expect(l.json.meshes).toHaveLength(1); // one mesh, one material: one draw call
    expect(l.json.materials).toHaveLength(1);
    expect(l.json.skins[0]!.joints.length).toBeLessThanOrEqual(32);
  });

  it('Snakes_(Hard)_ShouldHaveAGlbForEverySnakeOfTheBoard', () => {
    expect(HARD_SNAKES.map((s) => s.id).sort()).toEqual([...IDS].sort());
    expect(IDS).toHaveLength(13);
  });

  it.each(IDS)('Snake_(%s)_ShouldCarryTheSixClipsOfSpec54AtTheirFrameCounts', async (id) => {
    const l = await load(id);
    expect(l.clips.map((c) => c.name).sort()).toEqual(['hold', 'idle', 'rise', 'settle', 'strike', 'swallow']);
    const meta = SNAKE_META[id]!;
    expect(meta.clips).toMatchObject({ rise: 9, idle: 72, strike: 4, swallow: 8, settle: 5 });
    for (const clip of l.clips) expect(clip.duration).toBeCloseTo(meta.clips[clip.name as SnakeClip] / 24, 2);
  });
});

describe('Snake GLBs: RESPECT (T44 5.5, T02)', () => {
  it.each(IDS)('Snake_(%s)_ShouldHaveNothingWiderThan1p3RBehindTheHeadPlane_Item1', async (id) => {
    const meta = SNAKE_META[id]!;
    const l = await load(id);
    const R = radiusOf(meta);
    const B = new Vector3(...(meta.headBase as number[]) as [number, number, number]);
    const f = new Vector3(...(meta.headForward as number[]) as [number, number, number]);
    const axis = (meta.neckAxis as number[][]).map((p) => new Vector3(...(p as [number, number, number])));
    const coilTop = (meta.collarZ_u as number) + R;
    let widest = 0;
    for (const v of posed(l, id, 'idle', 0)) {
      if (v.y <= coilTop || v.clone().sub(B).dot(f) >= 0) continue;
      let near = axis[0]!;
      for (const p of axis) if (p.distanceToSquared(v) < near.distanceToSquared(v)) near = p;
      widest = Math.max(widest, Math.abs(v.x - near.x) / R);
    }
    expect(widest).toBeLessThanOrEqual(1.3);
  });

  it.each(IDS)('Snake_(%s)_ShouldHaveOneHeadAndNoHoodOrCanopyAboveOrBehindIt_Items2And3', async (id) => {
    const meta = SNAKE_META[id]!;
    const l = await load(id);
    const bones = l.json.nodes.filter((n) => n.name === 'head' || n.name === 'jaw');
    expect(bones.map((n) => n.name).sort()).toEqual(['head', 'jaw']); // one head, one jaw
    expect(meta.heads).toBe(1);
    expect(meta.hood).toBe(false);
    const R = radiusOf(meta);
    const B = new Vector3(...(meta.headBase as number[]) as [number, number, number]);
    const f = new Vector3(...(meta.headForward as number[]) as [number, number, number]);
    const coilTop = (meta.collarZ_u as number) + R;
    for (const v of posed(l, id, 'idle', 0)) {
      if (v.y <= coilTop || v.clone().sub(B).dot(f) >= 0) continue;
      expect(v.y).toBeLessThanOrEqual(B.y + R); // nothing rises behind or above the back of the head
    }
  });

  it.each(IDS)('Snake_(%s)_ShouldHaveNoPostInTheCoilCentre_Item4', async (id) => {
    const meta = SNAKE_META[id]!;
    const l = await load(id);
    const coilTop = (meta.collarZ_u as number) + radiusOf(meta);
    const inner = 0.25 * meta.coil_outer_u;
    const headUnderside = (meta.headBase as number[])[1]! - 3 * radiusOf(meta); // the head (and kabandha's arms) hang this far below the neck's top
    for (const v of posed(l, id, 'idle', 0)) {
      // inside the inner cylinder only the coil itself (up to its top) and, higher up, the head: no column between them
      if (Math.hypot(v.x, v.z) < inner && v.y > coilTop + 0.01) expect(v.y).toBeGreaterThanOrEqual(headUnderside);
    }
  });

  it.each(IDS)('Snake_(%s)_ShouldUseNoDevotionalMarksNamesOrFangs_Items5And7', async (id) => {
    const meta = SNAKE_META[id]!;
    const l = await load(id);
    const text = JSON.stringify([l.json.nodes.map((n) => n.name), l.json.materials.map((m) => m.name), l.json.meshes.map((m) => m.name), meta.motifs, meta.props]).toLowerCase();
    for (const banned of ['tilak', 'garland', 'lotus', 'conch', 'discus', 'chakra', 'hood', 'halo', 'naga', 'shesha', 'vasuki', 'fang', 'tooth', 'venom']) {
      expect(text).not.toContain(banned);
    }
    // no teeth: nothing white but the eye highlights
    const colour = l.body.geometry.attributes.color!;
    let white = 0;
    for (let i = 0; i < colour.count; i++) if (colour.getX(i) > 0.92 && colour.getY(i) > 0.92 && colour.getZ(i) > 0.92) white++;
    expect(white).toBeLessThanOrEqual(40);
  });

  it.each(IDS)('Snake_(%s)_ShouldKeepEveryHeadBelow0p75AndTheHeroShoulder_Item6', async (id) => {
    // R9 at the GLB's own scale. Owner exception (2026-11-03, T45.4): a close-up bite grows the coil to 1.6x at run
    // time (DioramaView.snakeGrow), so the head may pass the hero's shoulder while it bites, and only then.
    const l = await load(id);
    for (const [clip, u] of CLIPS_SAMPLED) {
      const top = Math.max(...posed(l, id, clip, u).map((v) => v.y));
      expect(top).toBeLessThanOrEqual(clip === 'rise' ? 0.75 * 1.08 : 0.75); // the rise overshoots by 8 % (spec 5.4)
      expect(top).toBeLessThan(0.92);
    }
  });

  it.each(IDS)('Snake_(%s)_ShouldStrikeItsMouthAtLeast0p15uTowardTheToken', (id) => {
    // spec 5.4: the strike carries the head 0.18 u toward the field centre (Kaikeyi included since T44.14)
    const m = SNAKE_META[id]!.mouth;
    expect(Math.hypot(m.strike[0] - m.idle[0], m.strike[2] - m.idle[2])).toBeGreaterThanOrEqual(0.15);
    expect(m.strike[2]).toBeGreaterThan(m.idle[2]); // toward the token, in front of the coil
  });

  it.each(IDS)('Snake_(%s)_ShouldDipTheHeadInTheStrike_Item6', (id) => {
    const m = SNAKE_META[id]!.mouth;
    expect(m.strike[1]).toBeLessThan(m.idle[1]);
  });

  it.each(IDS)('Snake_(%s)_ShouldMatchTheSizesTableOfSpec52', (id) => {
    const meta = SNAKE_META[id]!;
    const R = meta.R_du as number;
    const top = R <= 2.3 ? 29 : R <= 3.0 ? 33 + (R - 2.6) * 2.5 : R <= 3.5 ? 36 : 42;
    expect(Math.abs(meta.head_top_u * 56 - top)).toBeLessThanOrEqual(1); // within 1 du of the 5.2 table
    expect(meta.coil_outer_u * 56).toBeLessThanOrEqual((R <= 2.3 ? 10 : R <= 3.0 ? 11.5 : R <= 3.5 ? 12.3 : 14) + 0.2);
  });
});

describe('Snake GLBs: the snake stays in its head block (T44 5.2, 5.4: no body between head and tail)', () => {
  it.each(IDS)('Snake_(%s)_ShouldKeepEveryVertexOfEveryClipInsideItsHeadBlock', async (id) => {
    const l = await load(id);
    const back = (SNAKE_META[id]!.anchorBack as number | undefined) ?? ANCHOR_BACK; // this snake's own distance behind the block centre
    for (const [clip, u] of CLIPS_SAMPLED) {
      for (const v of posed(l, id, clip, u)) {
        // the coil centre stands ANCHOR_BACK behind the block centre, so the block spans z -0.5 .. 0.5 about it + ANCHOR_BACK
        expect(Math.abs(v.x)).toBeLessThanOrEqual(0.505);
        expect(v.z - back).toBeGreaterThanOrEqual(-0.505);
        expect(v.z - back).toBeLessThanOrEqual(0.505);
      }
    }
  });

  it.each(HARD_SNAKES.map((s) => [s.id, s.from, s.to] as const))(
    'Snake_(%s)_ShouldBeAnchoredOnItsHeadSquareAndFarFromItsTail',
    (id, from, to) => {
      const a = snakeAnchor(from);
      const tail = snakeAnchor(to);
      expect(Math.hypot(a[0] - tail[0], a[2] - tail[2])).toBeGreaterThan(1.4); // nothing of the snake reaches the tail
      expect(SNAKE_META[id]).toBeDefined();
    },
  );
});

describe('Snake GLBs: clearance from the bridges (T44 6.2 meets 5.2)', () => {
  it('Kaikeyi_(FullStrikeOn46)_ShouldStayAtLeast0p05uClearOfTheWeddingDeckInEveryClip', async () => {
    // owner, T44.14: the deck body (slab underside 0.045 below the walk, swags and posts up to 0.115 above it) never
    // comes within 0.05 u of her coil, neck or head, in plan or in height
    const l = await load('kaikeyi');
    const a = snakeAnchor(46, 'kaikeyi');
    const wedding = buildBridge('wedding', 26, 52);
    const ribbon = DECK_WIDTH / 2 + PARAPET_WIDTH + 0.05;
    let nearest = Infinity;
    for (const clip of ['rise', 'idle', 'hold', 'strike', 'swallow', 'settle'] as SnakeClip[]) {
      for (let k = 0; k <= 8; k++) {
        for (const v of posed(l, 'kaikeyi', clip, k / 8)) {
          for (const p of wedding.deck) {
            const plan = Math.hypot(v.x + a[0] - p.x, v.z + a[2] - p.z);
            nearest = Math.min(nearest, plan);
            if (plan > ribbon) continue;
            const y = v.y + a[1];
            expect(y <= p.y - 0.045 - 0.05 || y >= p.y + 0.115 + 0.05, `${clip} ${k}/8: y ${y.toFixed(3)} deck ${p.y.toFixed(3)}`).toBe(true);
          }
        }
      }
    }
    expect(nearest).toBeGreaterThan(0); // sanity: the deck was sampled
  });

  it.each(HARD_SNAKES.map((s) => [s.id, s.from] as const))('Snake_(%s)_ShouldClearEveryDeckOfTheBoard', async (id, from) => {
    const l = await load(id);
    const a = snakeAnchor(from, id);
    const ribbon = DECK_WIDTH / 2 + PARAPET_WIDTH + 0.02;
    const pairs = BRIDGE_PAIRS.filter((b) => boardFor('hard').ladders.some((x) => x.id === b.id));
    for (const [clip, u] of CLIPS_SAMPLED) {
      const verts = posed(l, id, clip, u);
      for (const pair of pairs) {
        const bridge = buildBridge(pair.id, pair.from, pair.to);
        for (const p of bridge.deck) {
          for (const v of verts) {
            if (Math.hypot(v.x + a[0] - p.x, v.z + a[2] - p.z) > ribbon) continue;
            // inside the ribbon in plan: the vertex is below the deck's underside (slab 0.045) or above its parapets
            const y = v.y + a[1];
            expect(y <= p.y - 0.05 || y >= p.y + 0.06, `${id} ${clip} ${u} vs ${pair.id}: y ${y.toFixed(3)} deck ${p.y.toFixed(3)}`).toBe(true);
          }
        }
      }
    }
  });
});
