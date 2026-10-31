// The built Sita GLB against the T44 contract: rig (braid bones, no tail), nine clips, budgets, stride/gait agreement
// with locomotion.ts, the respect items that can be asserted from numbers (R1, R3, R7 presence of lotus, braid and pallu
// in every clip), and the planted-foot drift measured on the skinned mesh in motion. R2 (face frames) is in
// heroFaceSita.test.ts. Eyeballed in screenshots-tmp/t44-sita: R10 colour restraint, R11 native-speaker pass.
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

const PATH = 'public/models/heroes/sita.glb';
const file = readFileSync(PATH);

interface GltfJson {
  nodes: { name?: string; extras?: Record<string, unknown> }[];
  skins: { joints: number[] }[];
  meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  accessors: { count: number; max?: number[] }[];
  animations: { name: string; samplers: { input: number }[] }[];
  materials: { name: string }[];
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
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(glb.buffer, '');
  return { scene: gltf.scene, clips: gltf.animations };
}

describe('Sita GLB: contract (T44 4 and 10)', () => {
  it('Glb_(Size)_ShouldStayUnderTheHero380KbBudget', () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(380 * 1024);
  });

  it('Rig_(Joints)_ShouldBeTheShared31MinusTailPlusBraidIs29AndAtMost32', () => {
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0]!.joints.length).toBe(29);
    expect(json.skins[0]!.joints.length).toBeLessThanOrEqual(32);
  });

  it('Rig_(BoneNames)_ShouldBeTheSharedHeroRigWithBraidInsteadOfTail', () => {
    const names = new Set(json.nodes.map((n) => n.name));
    const has = (bone: string): boolean => names.has(bone) || names.has(bone.replace('.', ''));
    for (const bone of [
      'root', 'hips', 'spine', 'chest', 'neck', 'head',
      'shoulder.L', 'upperArm.L', 'foreArm.L', 'hand.L', 'shoulder.R', 'upperArm.R', 'foreArm.R', 'hand.R',
      'thigh.L', 'shin.L', 'foot.L', 'toe.L', 'thigh.R', 'shin.R', 'foot.R', 'toe.R',
      'prop.R', 'prop.L', 'back', 'cloth.01', 'cloth.02', 'braid.01', 'braid.02',
    ]) {
      expect(has(bone), bone).toBe(true);
    }
    for (const tail of ['tail.01', 'tail.02', 'tail.03', 'tail.04']) expect(has(tail), tail).toBe(false);
  });

  it('Mesh_(Triangles)_ShouldBeAtMost4500IncludingLotusGarlandAndFace', () => {
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

  it('Height_(SoleToTiaraFinial)_ShouldTowerOverTheBlockAndEverySnake', () => {
    expect(extras.height_u as number).toBeGreaterThan(1.3);
    expect(extras.height_u as number).toBeLessThan(1.45);
  });

  it('Shoulders_(Standing)_ShouldBeAboveEverySnakeHeadTop', () => {
    expect(extras.shoulder_top_u as number).toBeGreaterThan(0.9);
  });

  it('Garland_(Loop)_ShouldBeAboutSixTenthsOfABoardUnit', () => {
    expect(extras.garland_loop_u as number).toBeGreaterThan(0.55);
    expect(extras.garland_loop_u as number).toBeLessThan(0.75);
  });

  it('Stride_(WalkAndRunCycles)_ShouldEqualTheLocomotionGaitCyclesOverFiftySix', () => {
    expect((extras.stride_m as number) * 56).toBeCloseTo(gaitFor(1, false).cycle, 6);
    expect((extras.run_stride_m as number) * 56).toBeCloseTo(gaitFor(3, false).cycle, 6);
  });
});

describe('Sita GLB: respect numbers from the Blender build (T44 4.4 R1 and R3)', () => {
  const report = JSON.parse(extras.report as string) as Record<
    string,
    {
      max_lean: number;
      min_head_over_hips: number;
      min_shoulder_top: number;
      max_shoulder_swing: number;
      max_elbow: number;
      max_free_swing: number;
      max_free_elbow: number;
      max_knee: number;
      land_max_knee: number;
    }
  >;

  it('R1_(UprightInEveryClip)_ShouldLeanAtMost8DegreesWithTheHeadAboveTheHips', () => {
    for (const clip of HERO_CLIPS) {
      expect(report[clip]!.max_lean, clip).toBeLessThanOrEqual(8);
      expect(report[clip]!.min_head_over_hips, clip).toBeGreaterThan(25);
    }
  });

  it('R1_(NeverKneelOrCrouch)_ShouldBendTheKneesAtMost60DegreesInEveryClip', () => {
    for (const clip of HERO_CLIPS) expect(report[clip]!.max_knee, clip).toBeLessThanOrEqual(60);
  });

  it('R9_(HeroesAboveVillains)_ShouldKeepTheShoulderTopAboveTheTallestSnakeHeadInEveryClip', () => {
    for (const clip of HERO_CLIPS) expect(report[clip]!.min_shoulder_top, clip).toBeGreaterThan(0.75 * 56);
  });

  it('R3_(SwiftStrideRun)_ShouldSwingEitherArmAtMost25DegreesAndBendTheElbowsAtMost60', () => {
    expect(report.run!.max_shoulder_swing).toBeLessThanOrEqual(25);
    expect(report.run!.max_elbow).toBeLessThanOrEqual(60);
    expect(report.run!.max_free_swing).toBeLessThanOrEqual(25);
    expect(report.run!.max_free_elbow).toBeLessThanOrEqual(60);
  });

  it('R3_(BoundNotAJump)_ShouldKeepTheArmsLowAndLandWithSoftKnees', () => {
    expect(report.leap!.max_shoulder_swing).toBeLessThanOrEqual(40);
    expect(report.leap!.land_max_knee).toBeLessThanOrEqual(45);
  });
});

describe('Sita GLB: the carried and worn pieces are visible in every clip (R7) and the feet are planted', () => {
  it('R7_(LotusBraidPallu)_ShouldStayAboveTheHipsAndNearHerAxisInEveryClip', async () => {
    const { scene, clips } = await load();
    const body = findBody(scene);
    const joints = body.skeleton.bones.map((b) => b.name);
    const skinIndex = body.geometry.attributes.skinIndex!;
    const skinWeight = body.geometry.attributes.skinWeight!;
    const dominant = (i: number): string => {
      let best = 0;
      let bestW = -1;
      for (let k = 0; k < 4; k++) {
        const w = [skinWeight.getX, skinWeight.getY, skinWeight.getZ, skinWeight.getW][k]!.call(skinWeight, i);
        if (w > bestW) {
          bestW = w;
          best = [skinIndex.getX, skinIndex.getY, skinIndex.getZ, skinIndex.getW][k]!.call(skinIndex, i);
        }
      }
      return joints[best]!;
    };
    const group = (names: string[]): number[] => {
      const out: number[] = [];
      for (let i = 0; i < body.geometry.attributes.position!.count; i++) if (names.includes(dominant(i))) out.push(i);
      return out;
    };
    const lotus = group(['propR']);
    const braid = group(['braid01', 'braid02']);
    const pallu = group(['cloth01', 'cloth02']);
    expect(lotus.length).toBeGreaterThan(150);
    expect(braid.length).toBeGreaterThan(40);
    expect(pallu.length).toBeGreaterThan(30);

    const mixer = new AnimationMixer(scene);
    const tmp = new Vector3();
    const stats = (indices: number[]): { minY: number; maxY: number; reach: number } => {
      let minY = 1e9;
      let maxY = -1e9;
      let reach = 0;
      for (const i of indices) {
        body.getVertexPosition(i, tmp);
        body.localToWorld(tmp);
        minY = Math.min(minY, tmp.y);
        maxY = Math.max(maxY, tmp.y);
        reach = Math.max(reach, Math.hypot(tmp.x, tmp.z));
      }
      return { minY, maxY, reach };
    };
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      for (let k = 0; k <= 6; k++) {
        action.time = (clip.duration * k) / 6 - (k === 6 ? 1e-3 : 0);
        mixer.update(0);
        scene.updateMatrixWorld(true);
        const l = stats(lotus);
        expect(l.maxY, `${clip.name} lotus bloom above the hips`).toBeGreaterThan(0.5);
        expect(l.reach, `${clip.name} lotus within reach of her`).toBeLessThan(0.9);
        const b = stats(braid);
        expect(b.maxY, `${clip.name} braid starts at her chest`).toBeGreaterThan(0.6);
        expect(b.minY, `${clip.name} braid hangs above the hem`).toBeGreaterThan(0.3);
        const p = stats(pallu);
        expect(p.minY, `${clip.name} pallu above the ground`).toBeGreaterThan(0.1);
        expect(p.maxY, `${clip.name} pallu from the shoulder`).toBeGreaterThan(0.5);
      }
    }
  });

  it('Feet_(WalkAndRunByDistance)_ShouldDriftAtMostOneHundredthOfABoardUnitWhilePlanted', async () => {
    const { scene, clips } = await load();
    const body = findBody(scene);
    const position = body.geometry.attributes.position!;
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < 0.045) (position.getX(i) > 0 ? left : right).push(i);
    }
    const mixer = new AnimationMixer(scene);
    const holder = new Object3D();
    holder.add(scene);
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
        const lowestOf = (indices: number[]): number => {
          let best = 1e9;
          for (const k of indices) {
            body.getVertexPosition(k, tmp);
            body.localToWorld(tmp);
            if (tmp.y < best) best = tmp.y;
          }
          return best;
        };
        const al = ankle.get('footL')!.getWorldPosition(new Vector3());
        const ar = ankle.get('footR')!.getWorldPosition(new Vector3());
        samples.push({ lowest: [lowestOf(left), lowestOf(right)], ankle: [al.z, ar.z] });
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

function findBody(scene: Group): SkinnedMesh {
  const skinned: SkinnedMesh[] = [];
  scene.traverse((o: Object3D) => {
    const m = o as SkinnedMesh;
    if (m.isSkinnedMesh && (m.material as Material).name !== 'face') skinned.push(m);
  });
  return skinned[0]!;
}
