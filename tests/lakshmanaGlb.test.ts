// The built Lakshmana GLB against the T44 contract: rig, nine clips, budgets, stride/gait agreement with locomotion.ts,
// respect numbers from the Blender build, and the planted-foot drift measured on the skinned mesh in motion.
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AnimationMixer,
  Object3D,
  Quaternion,
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

const PATH = 'public/models/heroes/lakshmana.glb';
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

describe('Lakshmana GLB: contract (T44 4 and 10)', () => {
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
    ]) {
      expect(names.has(bone) || names.has(bone.replace('.', '')), bone).toBe(true);
    }
  });

  it('Mesh_(Triangles)_ShouldBeAtMost4500IncludingBowQuiverAndFace', () => {
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

describe('Lakshmana GLB: respect numbers from the Blender build (T44 4.4, T43 7)', () => {
  const report = JSON.parse(extras.report as string) as Record<
    string,
    {
      max_lean: number;
      min_head_over_hips: number;
      min_shoulder_top: number;
      max_free_swing: number;
      max_free_elbow: number;
      max_knee: number;
      land_max_knee: number;
    }
  >;
  const BOARD_CLIPS = ['idle', 'walk', 'run', 'leap', 'happy', 'excited', 'scared', 'sad'];

  it('R1_(Bipedal)_ShouldLeanAtMost18DegreesAndKeepTheHeadAboveTheHipsOnTheBoard', () => {
    for (const clip of BOARD_CLIPS) {
      expect(report[clip]!.max_lean, clip).toBeLessThanOrEqual(18);
      expect(report[clip]!.min_head_over_hips, clip).toBeGreaterThan(20);
    }
  });

  it('R9_(HeroesAboveVillains)_ShouldKeepTheShoulderTopAboveTheTallestSnakeHeadInEveryBoardClip', () => {
    const snakeHeadTop = 0.75 * 56;
    for (const clip of BOARD_CLIPS)
      expect(report[clip]!.min_shoulder_top, clip).toBeGreaterThan(snakeHeadTop);
  });

  it('R15_(DignifiedRun)_ShouldKeepTheFreeArmWithin35DegreesAndElbowAt90', () => {
    expect(report.run!.max_free_swing).toBeLessThanOrEqual(36);
    expect(report.run!.max_free_elbow).toBeLessThanOrEqual(91);
  });

  it('R14_(LeapLanding)_ShouldBendTheKneesAtMost45DegreesOnTouchdown', () => {
    expect(report.leap!.land_max_knee).toBeLessThanOrEqual(45);
  });
});

describe('Lakshmana GLB: planted feet in motion', () => {
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

describe('Lakshmana GLB: his own identity (T44 4.3, 4.4 R4 R5 R7)', () => {
  const report = JSON.parse(extras.report as string) as Record<string, { max_bow_tilt: number }>;

  it('Rig_(NoTail)_ShouldCarrySharedRigPlusTheQuiverStrapAndNoTailBones', () => {
    const names = json.nodes.map((n) => n.name ?? '');
    expect(names.filter((n) => n.startsWith('tail'))).toEqual([]);
    expect(json.skins[0]!.joints.length).toBe(28);
    expect(names).toContain('quiver.strap');
  });

  it('R5_(BowNeverAimed)_ShouldStayWithin50DegreesOfUprightInEveryBoardClip', () => {
    for (const clip of ['idle', 'walk', 'run', 'leap', 'happy', 'excited', 'scared', 'sad'])
      expect(report[clip]!.max_bow_tilt, clip).toBeLessThanOrEqual(50);
  });

  it('BowPose_(LoadedClips)_ShouldMatchTheBlenderBuildSoHeldChannelsSurviveTheExport', async () => {
    // T44.14: Blender drops channels that are constant through a clip unless static channels are kept; the idle bow
    // hand is one, and without it the bow snaps to the rest pose in the game
    const { scene, clips } = await load();
    let prop: Object3D | null = null;
    scene.traverse((o: Object3D) => {
      if (o.name === 'prop.R' || o.name === 'propR') prop = o;
    });
    const mixer = new AnimationMixer(scene);
    for (const name of ['idle', 'walk', 'run', 'happy', 'sad']) {
      const clip = clips.find((c) => c.name === name)!;
      let worst = 0;
      for (let k = 0; k <= 24; k++) {
        mixer.stopAllAction();
        const action = mixer.clipAction(clip);
        action.reset().play();
        action.setEffectiveTimeScale(0);
        action.time = (clip.duration * k) / 24;
        mixer.update(0);
        scene.updateMatrixWorld(true);
        const up = new Vector3(0, 1, 0).applyQuaternion((prop as unknown as Object3D).getWorldQuaternion(new Quaternion()));
        worst = Math.max(worst, (Math.acos(Math.min(1, Math.abs(up.y))) * 180) / Math.PI);
      }
      expect(Math.abs(worst - report[name]!.max_bow_tilt), `${name}: ${worst.toFixed(1)} vs ${report[name]!.max_bow_tilt}`).toBeLessThanOrEqual(2);
    }
  });

  it('R4_(NoSomersault)_ShouldKeepTheHeadAboveTheHipsEvenInTheWinCheer', () => {
    const full = JSON.parse(extras.report as string) as Record<
      string,
      { max_lean: number; min_head_over_hips: number }
    >;
    expect(full.cheer!.max_lean).toBeLessThanOrEqual(18);
    expect(full.cheer!.min_head_over_hips).toBeGreaterThan(20);
  });

  it('R7_(IconographyEveryClip)_ShouldKeepBowQuiverAndHeadbandOnTheFigureAtEveryFrame', async () => {
    const { scene, clips } = await load();
    let body: SkinnedMesh | null = null;
    scene.traverse((o: Object3D) => {
      const m = o as SkinnedMesh;
      if (m.isSkinnedMesh && (m.material as Material).name !== 'face') body = m;
    });
    const mesh = body as SkinnedMesh | null;
    expect(mesh).not.toBeNull();
    const skinned = mesh!;
    const boneNames = skinned.skeleton.bones.map((b) => b.name);
    const joint = (name: string): number => boneNames.indexOf(name);
    const index = skinned.geometry.attributes.skinIndex!;
    const weight = skinned.geometry.attributes.skinWeight!;
    const colour = skinned.geometry.attributes.color!;
    const dominant = (i: number): { joint: number; weight: number } => {
      let best = { joint: -1, weight: 0 };
      for (let k = 0; k < 4; k++) {
        const w =
          k === 0 ? weight.getX(i) : k === 1 ? weight.getY(i) : k === 2 ? weight.getZ(i) : weight.getW(i);
        const j = k === 0 ? index.getX(i) : k === 1 ? index.getY(i) : k === 2 ? index.getZ(i) : index.getW(i);
        if (w > best.weight) best = { joint: j, weight: w };
      }
      return best;
    };
    const bow: number[] = [];
    const quiver: number[] = [];
    const headband: number[] = [];
    for (let i = 0; i < index.count; i++) {
      const d = dominant(i);
      if (d.joint === joint('propR')) {
        expect(d.weight).toBeGreaterThan(0.99); // rigid: the bow never leaves the hand
        bow.push(i);
      }
      if (d.joint === joint('back')) {
        expect(d.weight).toBeGreaterThan(0.99); // rigid: arrows never leave the quiver
        quiver.push(i);
      }
      const r = colour.getX(i);
      const g = colour.getY(i);
      const b = colour.getZ(i);
      if (d.joint === joint('head') && r > 0.15 && g / r > 0.28 && g / r < 0.46 && b / r < 0.08)
        headband.push(i);
    }
    expect(bow.length).toBeGreaterThan(100);
    expect(quiver.length).toBeGreaterThan(300);
    expect(headband.length, 'saffron headband and top-knot tie on the head').toBeGreaterThan(60);

    const mixer = new AnimationMixer(scene);
    const tmp = new Vector3();
    const extent = (indices: number[]): { size: number; centre: Vector3 } => {
      const lo = new Vector3(1e9, 1e9, 1e9);
      const hi = new Vector3(-1e9, -1e9, -1e9);
      for (const k of indices) {
        skinned.getVertexPosition(k, tmp);
        skinned.localToWorld(tmp);
        lo.min(tmp);
        hi.max(tmp);
      }
      return { size: hi.clone().sub(lo).length(), centre: lo.clone().add(hi).multiplyScalar(0.5) };
    };
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      for (let s = 0; s < 8; s++) {
        action.time = (clip.duration * s) / 8;
        mixer.update(0);
        scene.updateMatrixWorld(true);
        const b = extent(bow);
        const q = extent(quiver);
        expect(b.size, `${clip.name} bow length`).toBeGreaterThan(0.85); // 0.89 u tall, shorter than Rama's 1.10
        expect(b.size, `${clip.name} bow length`).toBeLessThan(1.1);
        expect(q.size, `${clip.name} quiver size`).toBeGreaterThan(0.4);
        expect(q.centre.y, `${clip.name} quiver height`).toBeGreaterThan(0.3);
      }
    }
  });
});
