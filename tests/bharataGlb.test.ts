// The built Bharata GLB against the T44 contract (rig, nine clips, budgets, stride/gait agreement with locomotion.ts,
// planted-foot drift on the skinned mesh) and the T46 padukas: both sandals rigid on the hands, at chest height or above,
// never on the ground, tops up, in every clip, measured from skinned vertices.
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AnimationMixer,
  Object3D,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
  type Bone,
  type Group,
  type Material,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { gaitFor } from '../src/game/iso/locomotion';
import {
  CLIP_FRAMES,
  CLIP_FPS,
  HERO_CLIPS,
  phaseFromDistance,
  clipTimeAtPhase,
} from '../src/app/board3d/heroClips';

const PATH = 'public/models/heroes/bharata.glb';
const file = readFileSync(PATH);

interface GltfJson {
  nodes: { name?: string; extras?: Record<string, unknown> }[];
  skins: { joints: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  accessors: { count: number; max?: number[] }[];
  animations: { name: string; samplers: { input: number }[] }[];
  materials: { name: string }[];
  images?: unknown[];
}

function readJson(): { json: GltfJson; bin: Uint8Array } {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength))) as GltfJson;
  const binStart = 20 + jsonLength;
  const binLength = view.getUint32(binStart, true);
  return { json, bin: file.subarray(binStart + 8, binStart + 8 + binLength) };
}

const { json, bin } = readJson();
const armature = json.nodes.find((n) => n.extras && 'stride_m' in n.extras)!;
const extras = armature.extras as Record<string, number | string>;

/** Parse the GLB in node: the placeholder face image needs a DOM, so the texture is dropped from the copy. */
async function load(): Promise<{ scene: Group; clips: AnimationClip[] }> {
  const copy = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
  delete copy.images;
  delete copy.textures;
  delete copy.samplers;
  for (const material of copy.materials as { pbrMetallicRoughness?: { baseColorTexture?: unknown } }[]) {
    delete material.pbrMetallicRoughness?.baseColorTexture;
  }
  const jsonText = new TextEncoder().encode(JSON.stringify(copy));
  const pad = (data: Uint8Array, fill: number): Uint8Array => {
    const out = new Uint8Array(data.length + ((4 - (data.length % 4)) % 4)).fill(fill);
    out.set(data);
    return out;
  };
  const jsonChunk = pad(jsonText, 0x20);
  const binChunk = pad(bin, 0);
  const glb = new Uint8Array(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.length, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonChunk, 20);
  view.setUint32(20 + jsonChunk.length, binChunk.length, true);
  view.setUint32(24 + jsonChunk.length, 0x004e4942, true);
  glb.set(binChunk, 28 + jsonChunk.length);
  const buffer = glb.buffer;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer, '');
  return { scene: gltf.scene, clips: gltf.animations };
}

describe('Bharata GLB: contract (T44 4 and 10)', () => {
  it('Glb_(Size)_ShouldStayUnderTheHero380KbBudget', () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(380 * 1024);
  });

  it('Rig_(Joints)_ShouldBeAtMost32Bones', () => {
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0]!.joints.length).toBeLessThanOrEqual(32);
  });

  it('Rig_(BoneNames)_ShouldBeTheSharedHeroRig', () => {
    const names = new Set(json.nodes.map((n) => n.name));
    for (const bone of [
      'root',
      'hips',
      'spine',
      'chest',
      'neck',
      'head',
      'shoulder.L',
      'upperArm.L',
      'foreArm.L',
      'hand.L',
      'shoulder.R',
      'upperArm.R',
      'foreArm.R',
      'hand.R',
      'thigh.L',
      'shin.L',
      'foot.L',
      'toe.L',
      'thigh.R',
      'shin.R',
      'foot.R',
      'toe.R',
      'prop.R',
      'prop.L',
      'back',
      'cloth.01',
      'cloth.02',
      'tail.01',
      'tail.02',
      'tail.03',
      'tail.04',
    ]) {
      expect(names.has(bone) || names.has(bone.replace('.', '')), bone).toBe(true);
    }
  });

  it('Mesh_(Triangles)_ShouldBeAtMost4500IncludingPadukasAndFace', () => {
    const triangles = json.meshes
      .flatMap((m) => m.primitives)
      .reduce((sum, p) => sum + json.accessors[p.indices]!.count / 3, 0);
    expect(triangles).toBeLessThanOrEqual(4500);
  });

  it('Mesh_(DrawCalls)_ShouldBeOneClayPrimitiveAndOneFacePatch', () => {
    expect(json.meshes).toHaveLength(1);
    expect(json.meshes[0]!.primitives).toHaveLength(2);
    expect(json.materials.map((m) => m.name).sort()).toEqual(['clay', 'face']);
    for (const p of json.meshes[0]!.primitives) {
      expect(p.attributes.JOINTS_0).toBeDefined();
      expect(p.attributes.WEIGHTS_0).toBeDefined();
    }
  });

  it('Clips_(Names)_ShouldBeTheNineOfTheSpec', () => {
    expect(json.animations.map((a) => a.name).sort()).toEqual([...HERO_CLIPS].sort());
  });

  it('Clips_(Durations)_ShouldBeFramesOverTwentyFourFps', () => {
    for (const animation of json.animations) {
      const frames = CLIP_FRAMES[animation.name as keyof typeof CLIP_FRAMES];
      const end = Math.max(...animation.samplers.map((s) => json.accessors[s.input]!.max![0]!));
      expect(end, animation.name).toBeCloseTo(frames / CLIP_FPS, 4);
    }
  });

  it('Height_(SoleToCrown)_ShouldBeAbout1Point43BoardUnits', () => {
    expect(extras.height_u as number).toBeGreaterThan(1.42);
    expect(extras.height_u as number).toBeLessThan(1.44);
  });

  it('Shoulders_(Standing)_ShouldBeAboveEverySnakeHeadTop', () => {
    expect(extras.shoulder_top_u as number).toBeGreaterThan(0.75);
    expect(extras.shoulder_top_u as number).toBeGreaterThan(0.9);
  });

  it('Stride_(WalkAndRunCycles)_ShouldEqualTheLocomotionGaitCyclesOverFiftySix', () => {
    expect((extras.stride_m as number) * 56).toBeCloseTo(gaitFor(1, false).cycle, 6);
    expect((extras.run_stride_m as number) * 56).toBeCloseTo(gaitFor(3, false).cycle, 6);
    expect(gaitFor(2, false).clip).toBe('walk');
    expect(gaitFor(3, false).clip).toBe('run');
    expect(gaitFor(1, true).clip).toBe('run');
  });
});

describe('Bharata GLB: respect numbers from the Blender build (T44 4.4 R1 R3, T46 padukas)', () => {
  interface ClipReport {
    max_lean: number;
    min_head_over_hips: number;
    min_shoulder_top: number;
    max_knee: number;
    land_max_knee: number;
    min_knee_z: number;
    right_hand_over_midline: number;
    left_hand_over_midline: number;
    min_hand_to_face: number;
    pad_min_z: number;
    pad_max_z: number;
    pad_min_above_hips: number;
    pad_min_top_normal_z: number;
    pad_min_to_face: number;
    wrist_range_in_chest_frame: number;
  }
  const report = JSON.parse(extras.report as string) as Record<string, ClipReport>;
  const ALL = [...HERO_CLIPS];
  const HEIGHT_DU = 80.2; // sole to the top-knot jewel, design units (1.432 u x 56)

  it('R1_(BharataPosture)_ShouldLeanAtMost8DegreesAndKeepTheHeadAboveTheHipsInEveryClip', () => {
    for (const clip of ALL) {
      expect(report[clip]!.max_lean, clip).toBeLessThanOrEqual(8);
      expect(report[clip]!.min_head_over_hips, clip).toBeGreaterThan(28);
    }
  });

  it('R1_(NoKneelOrCrouch)_ShouldNeverBendAKneePast60DegreesOrDropTheKneesFarBelowTheRestHeight', () => {
    for (const clip of ALL) {
      expect(report[clip]!.max_knee, clip).toBeLessThanOrEqual(60);
      expect(report[clip]!.min_knee_z, clip).toBeGreaterThan(10.5); // rest 13.5 du: a kneel would be far lower
    }
  });

  it('R1_(NoCrossedArmsOrCoveredFace)_ShouldKeepEachHandOnItsOwnSideAndAwayFromTheFace', () => {
    for (const clip of ALL) {
      expect(report[clip]!.right_hand_over_midline, clip).toBeLessThan(0);
      expect(report[clip]!.left_hand_over_midline, clip).toBeLessThan(0);
      expect(report[clip]!.min_hand_to_face, clip).toBeGreaterThan(8);
    }
  });

  it('R3_(SwiftStrideAndBound)_ShouldKeepTheRunLeanAtMost8AndTheLeapKneesAtMost60WithATouchdownUnder45', () => {
    expect(report.run!.max_lean).toBeLessThanOrEqual(8);
    expect(report.run!.max_knee).toBeLessThanOrEqual(60);
    expect(report.leap!.max_knee).toBeLessThanOrEqual(60);
    expect(report.leap!.land_max_knee).toBeLessThanOrEqual(45);
  });

  it('Padukas_(Carried)_ShouldNeverSwingTheWristsMoreThanAFewDesignUnitsInTheChestFrame', () => {
    for (const clip of ALL) expect(report[clip]!.wrist_range_in_chest_frame, clip).toBeLessThanOrEqual(5);
  });

  it('Padukas_(HeightFromFK)_ShouldStayAtChestHeightOrAboveAndAboveTheHipsInEveryClip', () => {
    for (const clip of ALL) {
      expect(report[clip]!.pad_min_z, clip).toBeGreaterThanOrEqual(0.6 * HEIGHT_DU);
      expect(report[clip]!.pad_min_above_hips, clip).toBeGreaterThan(20);
    }
  });

  it('Padukas_(Level)_ShouldKeepTheWoodenTopsUpAndTheSolesDownToTheHandsInEveryClip', () => {
    for (const clip of ALL) expect(report[clip]!.pad_min_top_normal_z, clip).toBeGreaterThan(0.9);
  });

  it('Padukas_(FromTheFace)_ShouldStayClearOfTheFaceAndBelowTheChinLine', () => {
    for (const clip of ALL) {
      expect(report[clip]!.pad_min_to_face, clip).toBeGreaterThan(4);
      expect(report[clip]!.pad_max_z, clip).toBeLessThan(55); // chin at 54.3 du
    }
  });

  it('R9_(HeroesAboveVillains)_ShouldKeepTheShoulderTopAboveTheTallestSnakeHeadInEveryClip', () => {
    const snakeHeadTop = 0.75 * 56;
    for (const clip of ALL) expect(report[clip]!.min_shoulder_top, clip).toBeGreaterThan(snakeHeadTop);
  });
});

type Rgb = [number, number, number];

interface BodyVertex {
  index: number;
  bone: string;
  weight: number; // the dominant joint's weight
  rgb: Rgb;
  y: number;
}

async function loadBody(): Promise<{
  scene: Group;
  clips: AnimationClip[];
  body: SkinnedMesh;
  vertices: BodyVertex[];
}> {
  const { scene, clips } = await load();
  let found: SkinnedMesh | null = null;
  scene.traverse((o: Object3D) => {
    const m = o as SkinnedMesh;
    if (m.isSkinnedMesh && (m.material as Material).name !== 'face') found = m;
  });
  const body = found as unknown as SkinnedMesh;
  const names = body.skeleton.bones.map((b) => b.name);
  const g = body.geometry;
  const index = g.attributes.skinIndex!;
  const weight = g.attributes.skinWeight!;
  const color = g.attributes.color!;
  const position = g.attributes.position!;
  const vertices: BodyVertex[] = [];
  for (let i = 0; i < position.count; i++) {
    let best = 0;
    let bestW = -1;
    const ws = [weight.getX(i), weight.getY(i), weight.getZ(i), weight.getW(i)];
    const js = [index.getX(i), index.getY(i), index.getZ(i), index.getW(i)];
    ws.forEach((w, k) => {
      if (w > bestW) {
        bestW = w;
        best = js[k]!;
      }
    });
    vertices.push({
      index: i,
      bone: names[best]!,
      weight: bestW,
      rgb: [color.getX(i), color.getY(i), color.getZ(i)],
      y: position.getY(i),
    });
  }
  return { scene, clips, body, vertices };
}

const isViolet = (c: Rgb): boolean => c[2] > 1.5 * c[0] && c[2] > c[1] && c[0] > c[1];
const isGold = (c: Rgb): boolean => c[0] > 1.4 * c[2] && c[1] > 1.3 * c[2] && c[1] > 0.6 * c[0];
const isWheat = (c: Rgb): boolean => c[0] > c[1] && c[1] > c[2] && c[0] < 3.2 * c[2];
/** Sandal wood, the gold knob and the heel jewel: the warm, blue-poor colours (skin keeps b/r = 0.32). */
const isPaduka = (c: Rgb): boolean => c[2] < 0.2 * c[0];
/** Sandal wood only: warm and blue-poor, but less green than gold (g/r 0.4 against 0.65). */
const isWood = (c: Rgb): boolean => isPaduka(c) && c[1] < 0.55 * c[0];
const on =
  (name: string) =>
  (v: { bone: string }): boolean =>
    v.bone === name || v.bone === name.replace('.', '');

describe('Bharata GLB: iconography is in the mesh (T46, T44 4.3, R7, R10)', () => {
  it('R7_(Diadem)_ShouldBeGoldAboveTheBrowAndTheTopKnotJewelViolet', async () => {
    const { vertices } = await loadBody();
    const crown = vertices.filter((v) => on('head')(v) && v.y > 1.15 && isGold(v.rgb));
    expect(crown.length).toBeGreaterThan(150);
    expect(vertices.filter((v) => on('head')(v) && v.y > 1.38 && isViolet(v.rgb)).length).toBeGreaterThan(10);
  });

  it('R7_(VioletGarments)_ShouldBeVioletOnTheChestSpineAndHips', async () => {
    const { vertices } = await loadBody();
    const violet = vertices.filter((v) => isViolet(v.rgb));
    expect(violet.length).toBeGreaterThan(400);
    for (const b of ['chest', 'spine', 'hips']) expect(violet.some(on(b)), b).toBe(true);
  });

  it('R7_(NoRamaProps)_ShouldCarryNoBowOrQuiverOnTheBackOrPropBones', async () => {
    const { vertices } = await loadBody();
    for (const b of ['prop.L', 'prop.R', 'back']) expect(vertices.filter(on(b)), b).toHaveLength(0);
  });

  it('R10_(NaturalSkin)_ShouldNeverPaintTheFeetOrNeckViolet', async () => {
    const { vertices } = await loadBody();
    // the thigh bones also carry the violet dhoti (it follows the legs), so they are left out here
    const skinBones = ['foot.L', 'foot.R', 'neck', 'toe.L', 'toe.R'];
    const skin = vertices.filter((v) => skinBones.some((b) => on(b)(v)));
    expect(skin.length).toBeGreaterThan(100);
    expect(skin.filter((v) => isViolet(v.rgb))).toHaveLength(0);
    expect(skin.filter((v) => isWheat(v.rgb)).length / skin.length).toBeGreaterThan(0.7);
  });
});

describe("Bharata GLB: Rama's padukas stay reverently in both hands in every clip (T46 respect)", () => {
  const heightU = extras.height_u as number;

  it('Padukas_(Skinning)_ShouldBeRigidOnEachHandWithWeightAboveNinetyNinePercent', async () => {
    const { vertices } = await loadBody();
    for (const hand of ['hand.L', 'hand.R']) {
      const pad = vertices.filter((v) => on(hand)(v) && isPaduka(v.rgb));
      expect(pad.length, hand).toBeGreaterThan(60);
      for (const v of pad) expect(v.weight, `${hand} vertex ${v.index}`).toBeGreaterThan(0.99);
    }
    // sandal wood rides on no other bone
    const sandal = vertices.filter((v) => isWood(v.rgb));
    expect(sandal.length).toBeGreaterThan(50);
    for (const v of sandal)
      expect(on('hand.L')(v) || on('hand.R')(v), `${v.bone} vertex ${v.index}`).toBe(true);
  });

  it('Padukas_(EveryClipEverySample)_ShouldStayAtChestHeightOrAboveAboveTheHipsAndOffTheGroundWithTopsUp', async () => {
    const { scene, clips, body, vertices } = await loadBody();
    const mixer = new AnimationMixer(scene);
    const tmp = new Vector3();
    const hips = new Vector3();
    let hipsBone: Object3D | null = null;
    scene.traverse((o: Object3D) => {
      if (o.name === 'hips') hipsBone = o;
    });
    // per side: the sandal vertices split by their REST distance outward from the palm (the wooden top is the far side)
    const near = new Map<string, number[]>();
    const far = new Map<string, number[]>();
    const restX = body.geometry.attributes.position!;
    for (const side of ['L', 'R']) {
      const sign = side === 'L' ? 1 : -1;
      const pads = vertices
        .filter((v) => on(`hand.${side}`)(v) && isPaduka(v.rgb))
        .map((v) => ({ index: v.index, out: sign * restX.getX(v.index) }))
        .sort((p, q) => p.out - q.out);
      expect(pads.length, `${side} sandal`).toBeGreaterThan(60);
      const half = Math.floor(pads.length / 2);
      near.set(
        side,
        pads.slice(0, half).map((p) => p.index),
      );
      far.set(
        side,
        pads.slice(half).map((p) => p.index),
      );
    }
    const heights = (indices: number[]): { mean: number; low: number } => {
      let sum = 0;
      let low = 1e9;
      for (const k of indices) {
        body.getVertexPosition(k, tmp);
        body.localToWorld(tmp);
        sum += tmp.y;
        low = Math.min(low, tmp.y);
      }
      return { mean: sum / indices.length, low };
    };
    let samples = 0;
    let lowest = 1e9;
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      for (let f = 0; f <= clip.duration * 24; f += 2) {
        action.time = Math.min(f / 24, clip.duration);
        mixer.update(0);
        scene.updateMatrixWorld(true);
        body.skeleton.update();
        (hipsBone as unknown as Object3D).getWorldPosition(hips);
        for (const side of ['L', 'R']) {
          const n = heights(near.get(side)!);
          const t = heights(far.get(side)!);
          const low = Math.min(n.low, t.low);
          lowest = Math.min(lowest, low);
          const label = `${clip.name} f${f} ${side}`;
          expect(low, `${label}: never below 0.6 of the hero height`).toBeGreaterThanOrEqual(0.6 * heightU);
          expect(low, `${label}: above the hips`).toBeGreaterThan(hips.y + 0.3);
          expect(low, `${label}: never touching the ground`).toBeGreaterThan(0.3);
          // wooden tops up: the far (top) half of the sandal is higher than the near (sole) half, so the soles face down
          expect(t.mean - n.mean, `${label}: soles turned down`).toBeGreaterThan(0.01);
        }
        samples++;
      }
    }
    expect(samples).toBeGreaterThan(150);
    expect(lowest).toBeGreaterThanOrEqual(0.6 * heightU);
  });

  it('Padukas_(TravelWithTheHands)_ShouldKeepEachSandalAtOneDistanceFromItsHandBoneInEveryClip', async () => {
    const { scene, clips, body, vertices } = await loadBody();
    const mixer = new AnimationMixer(scene);
    const find = (...names: string[]): Object3D => {
      let hit: Object3D | null = null;
      scene.traverse((o: Object3D) => {
        if (names.includes(o.name)) hit = o;
      });
      return hit as unknown as Object3D;
    };
    const tmp = new Vector3();
    const centroid = new Vector3();
    const hand = new Vector3();
    for (const side of ['L', 'R']) {
      const pad = vertices.filter((v) => on(`hand.${side}`)(v) && isPaduka(v.rgb)).map((v) => v.index);
      const bone = find(`hand.${side}`, `hand${side}`);
      let rest: number | null = null;
      for (const clip of clips) {
        const action = mixer.clipAction(clip);
        mixer.stopAllAction();
        action.reset().play();
        action.setEffectiveTimeScale(0);
        for (let f = 0; f <= clip.duration * 24; f += 4) {
          action.time = Math.min(f / 24, clip.duration);
          mixer.update(0);
          scene.updateMatrixWorld(true);
          body.skeleton.update();
          centroid.set(0, 0, 0);
          for (const k of pad) {
            body.getVertexPosition(k, tmp);
            body.localToWorld(tmp);
            centroid.add(tmp);
          }
          centroid.divideScalar(pad.length);
          bone.getWorldPosition(hand);
          const d = centroid.distanceTo(hand);
          // a rigid body on the hand: the centroid keeps one distance from the wrist in every clip
          rest ??= d;
          expect(Math.abs(d - rest), `${side} ${clip.name} f${f}`).toBeLessThan(0.02);
        }
      }
      expect(rest, side).toBeLessThan(0.2); // a sandal's length from the wrist
    }
  });
});

describe('Bharata GLB: planted feet in motion', () => {
  it('Feet_(WalkAndRunByDistance)_ShouldDriftAtMostOneHundredthOfABoardUnitWhilePlanted', async () => {
    const { scene, clips } = await load();
    const skinned: SkinnedMesh[] = [];
    scene.traverse((o: Object3D) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh && (m.material as Material).name !== 'face') skinned.push(m);
    });
    const body = skinned[0]!;
    const position = body.geometry.attributes.position!;
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0.045) (position.getX(i) > 0 ? left : right).push(i);
    }
    const mixer = new AnimationMixer(scene);
    const holder = new Object3D();
    holder.add(scene);
    holder.rotation.y = 0; // the GLB faces +z: walk along +z
    const tmp = new Vector3();
    const ankle = new Map<string, Bone>();
    scene.traverse((o: Object3D) => {
      if (o.name === 'footL' || o.name === 'footR') ankle.set(o.name, o as Bone);
    });

    for (const [clipName, cycle] of [
      ['walk', extras.stride_m as number],
      ['run', extras.run_stride_m as number],
    ] as const) {
      const action = mixer.clipAction(clips.find((c) => c.name === clipName)!);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      const steps = 96;
      const cycles = 3;
      const samples: { lowest: [number, number]; ankle: [number, number] }[] = [];
      for (let i = 0; i <= steps * cycles; i++) {
        const d = (cycle * i) / steps;
        holder.position.set(0, 0, d);
        action.time = clipTimeAtPhase(clipName, phaseFromDistance(d, cycle));
        mixer.update(0);
        holder.updateMatrixWorld(true);
        const lowestOf = (indices: number[]): number[] => {
          let best = [0, 1e9, 0];
          for (const k of indices) {
            body.getVertexPosition(k, tmp);
            body.localToWorld(tmp);
            if (tmp.y < best[1]!) best = tmp.toArray();
          }
          return best;
        };
        const l = lowestOf(left);
        const r = lowestOf(right);
        const al = ankle.get('footL')!.getWorldPosition(new Vector3());
        const ar = ankle.get('footR')!.getWorldPosition(new Vector3());
        samples.push({ lowest: [l[1]!, r[1]!], ankle: [al.z, ar.z] });
      }
      for (const foot of [0, 1] as const) {
        const ys = samples.map((s) => s.lowest[foot]);
        const threshold = Math.min(...ys) + 0.006;
        const runs: number[][] = [];
        let current: number[] = [];
        for (const s of samples) {
          if (s.lowest[foot] <= threshold) current.push(s.ankle[foot]);
          else if (current.length) {
            runs.push(current);
            current = [];
          }
        }
        if (current.length) runs.push(current);
        const planted = runs.filter((run) => run.length >= 6);
        expect(planted.length, `${clipName} foot ${foot} stance windows`).toBeGreaterThanOrEqual(2);
        for (const run of planted) {
          expect(Math.max(...run) - Math.min(...run), `${clipName} foot ${foot}`).toBeLessThanOrEqual(0.01);
        }
      }
    }
  });
});
