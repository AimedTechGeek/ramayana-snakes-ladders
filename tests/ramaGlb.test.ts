// The built Rama GLB against the T44 contract: rig, nine clips, budgets, stride/gait agreement with locomotion.ts,
// respect numbers from the Blender build, and the planted-foot drift measured on the skinned mesh in motion.
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AnimationMixer,
  Object3D,
  SkinnedMesh,
  Quaternion,
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

const PATH = 'public/models/heroes/rama.glb';
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

describe('Rama GLB: contract (T44 4 and 10)', () => {
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

describe('Rama GLB: respect numbers from the Blender build (T44 4.4 R1 R3 R5 R9)', () => {
  interface ClipReport {
    max_lean: number;
    min_head_over_hips: number;
    min_shoulder_top: number;
    max_shoulder_swing: number;
    max_free_swing: number;
    max_free_elbow: number;
    max_elbow: number;
    max_knee: number;
    land_max_knee: number;
    bow_min_z: number;
    bow_min_tilt_fwd: number;
    bow_max_tilt_fwd: number;
    min_knee_z: number;
    right_hand_over_midline: number;
    left_hand_over_midline: number;
    min_hand_to_face: number;
  }
  const report = JSON.parse(extras.report as string) as Record<string, ClipReport>;
  const ALL = [...HERO_CLIPS];

  it('R1_(RamaPosture)_ShouldLeanAtMost8DegreesAndKeepTheHeadAboveTheHipsInEveryClip', () => {
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

  it('R3_(SwiftStride)_ShouldSwingTheFreeArmAtMost25DegreesWithElbowsAtMost60AndLeanAtMost8', () => {
    expect(report.run!.max_free_swing).toBeLessThanOrEqual(25);
    expect(report.run!.max_free_elbow).toBeLessThanOrEqual(60);
    expect(report.run!.max_elbow).toBeLessThanOrEqual(60);
    expect(report.run!.max_lean).toBeLessThanOrEqual(8);
  });

  it('R3_(BoundNotTuck)_ShouldBendTheKneesAtMost60InTheAirAnd45OnTouchdownWithTheArmsLow', () => {
    expect(report.leap!.max_knee).toBeLessThanOrEqual(60);
    expect(report.leap!.land_max_knee).toBeLessThanOrEqual(45);
    expect(report.leap!.max_shoulder_swing).toBeLessThanOrEqual(30);
  });

  it('R5_(Bow)_ShouldStayUprightOrForwardNeverBackAndOffTheGround', () => {
    for (const clip of ALL) {
      expect(report[clip]!.bow_min_tilt_fwd, clip).toBeGreaterThanOrEqual(-1);
      expect(report[clip]!.bow_max_tilt_fwd, clip).toBeLessThanOrEqual(35);
      expect(report[clip]!.bow_min_z, clip).toBeGreaterThan(1);
    }
    expect(report.idle!.bow_max_tilt_fwd).toBeLessThan(1); // upright at rest
    expect(report.walk!.bow_min_tilt_fwd).toBeCloseTo(20, 0); // 20 degrees forward when walking (T44 4.3)
    expect(extras.bow_height_u as number).toBeCloseTo(1.1, 2);
  });

  it('R9_(HeroesAboveVillains)_ShouldKeepTheShoulderTopAboveTheTallestSnakeHeadInEveryClip', () => {
    const snakeHeadTop = 0.75 * 56;
    for (const clip of ALL) expect(report[clip]!.min_shoulder_top, clip).toBeGreaterThan(snakeHeadTop);
  });
});

type Rgb = [number, number, number];

/** The skinned body: per vertex the dominant bone, the colour and the height, read off the loaded GLB. */
async function bodyVertices(): Promise<{ bone: string; rgb: Rgb; y: number }[]> {
  const { scene } = await load();
  let body: SkinnedMesh | null = null;
  scene.traverse((o: Object3D) => {
    const m = o as SkinnedMesh;
    if (m.isSkinnedMesh && (m.material as Material).name !== 'face') body = m;
  });
  const mesh = body as unknown as SkinnedMesh;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const g = mesh.geometry;
  const index = g.attributes.skinIndex!;
  const weight = g.attributes.skinWeight!;
  const color = g.attributes.color!;
  const position = g.attributes.position!;
  const out: { bone: string; rgb: Rgb; y: number }[] = [];
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
    out.push({ bone: names[best]!, rgb: [color.getX(i), color.getY(i), color.getZ(i)], y: position.getY(i) });
  }
  return out;
}

describe('Rama GLB: iconography is in the mesh (T44 4.3, R7, R10)', () => {
  const isBlue = (c: Rgb): boolean => c[2] > 1.5 * c[0] && c[2] > c[1];
  const isGold = (c: Rgb): boolean => c[0] > 1.4 * c[2] && c[1] > 1.3 * c[2] && c[1] > 0.6 * c[0];
  const isWheat = (c: Rgb): boolean => c[0] > c[1] && c[1] > c[2] && c[0] < 3.2 * c[2];
  const on =
    (name: string) =>
    (v: { bone: string }): boolean =>
      v.bone === name || v.bone === name.replace('.', '');

  it('R7_(BowAndQuiver)_ShouldBeSkinnedToThePropAndBackBonesSoTheyTravelWithEveryClip', async () => {
    const verts = await bodyVertices();
    expect(verts.filter(on('prop.L')).length).toBeGreaterThan(150);
    expect(verts.filter(on('back')).length).toBeGreaterThan(250);
    expect(verts.filter(on('prop.R'))).toHaveLength(0); // the right hand carries nothing
  });

  it('R7_(Crown)_ShouldBeGoldAboveTheHeadAndTheBowLimbsGold', async () => {
    const verts = await bodyVertices();
    const crown = verts.filter((v) => on('head')(v) && v.y > 1.2 && isGold(v.rgb));
    expect(crown.length).toBeGreaterThan(100);
    expect(verts.filter((v) => on('prop.L')(v) && isGold(v.rgb)).length).toBeGreaterThan(80);
  });

  it('R7_(BlueUttariya)_ShouldBeBlueOnTheChestSpineAndHips', async () => {
    const verts = await bodyVertices();
    const blue = verts.filter((v) => isBlue(v.rgb));
    expect(blue.length).toBeGreaterThan(150);
    for (const b of ['chest', 'spine', 'hips']) expect(blue.some(on(b)), b).toBe(true);
  });

  it('R10_(NaturalSkin)_ShouldNeverPaintTheHandsFeetNeckOrLegsBlue', async () => {
    const verts = await bodyVertices();
    const skinBones = [
      'hand.L',
      'hand.R',
      'foot.L',
      'foot.R',
      'neck',
      'thigh.L',
      'thigh.R',
      'toe.L',
      'toe.R',
    ];
    const skin = verts.filter((v) => skinBones.some((b) => on(b)(v)));
    expect(skin.length).toBeGreaterThan(300);
    expect(skin.filter((v) => isBlue(v.rgb))).toHaveLength(0);
    expect(skin.filter((v) => isWheat(v.rgb)).length / skin.length).toBeGreaterThan(0.7);
  });
});

describe('Rama GLB: quiver and bow travel with the body in every clip (R7)', () => {
  it('Quiver_(EveryClip)_ShouldStayBehindTheChestAndTheBowInTheLeftHand', async () => {
    const { scene, clips } = await load();
    const find = (...names: string[]): Object3D => {
      let hit: Object3D | null = null;
      scene.traverse((o: Object3D) => {
        if (names.includes(o.name)) hit = o;
      });
      return hit as unknown as Object3D;
    };
    const back = find('back');
    const chest = find('chest');
    const prop = find('prop.L', 'propL');
    const hand = find('hand.L', 'handL');
    const mixer = new AnimationMixer(scene);
    const p = new Vector3();
    const q = new Vector3();
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      for (let f = 0; f <= clip.duration * 24; f += 3) {
        action.time = Math.min(f / 24, clip.duration);
        mixer.update(0);
        scene.updateMatrixWorld(true);
        back.getWorldPosition(p);
        chest.getWorldPosition(q);
        expect(
          p.z - q.z,
          `${clip.name} f${f}: the quiver is behind the chest (the GLB faces +z)`,
        ).toBeLessThan(-0.03);
        prop.getWorldPosition(p);
        hand.getWorldPosition(q);
        expect(p.distanceTo(q), `${clip.name} f${f}: the bow stays in the hand`).toBeLessThan(0.08);
      }
    }
  });

  it('Bow_(WorldAxis)_ShouldBeUprightAtIdleAndTwentyDegreesForwardWhileWalkingInTheLoadedClips', async () => {
    const { scene, clips } = await load();
    let prop: Object3D | null = null;
    scene.traverse((o: Object3D) => {
      if (o.name === 'prop.L' || o.name === 'propL') prop = o;
    });
    const mixer = new AnimationMixer(scene);
    const tiltOf = (name: string, time: number): number => {
      const action = mixer.clipAction(clips.find((c) => c.name === name)!);
      mixer.stopAllAction();
      action.reset().play();
      action.setEffectiveTimeScale(0);
      action.time = time;
      mixer.update(0);
      scene.updateMatrixWorld(true);
      const quaternion = (prop as unknown as Object3D).getWorldQuaternion(new Quaternion());
      const axis = new Vector3(0, 1, 0).applyQuaternion(quaternion);
      return (Math.atan2(axis.z, axis.y) * 180) / Math.PI; // + = top forward (the GLB faces +z)
    };
    // the baked prop rotation must survive the export (static channels used to be dropped)
    expect(tiltOf('idle', 0.4)).toBeLessThan(3);
    expect(tiltOf('happy', 1.4)).toBeLessThan(8);
    expect(tiltOf('walk', 0.3)).toBeGreaterThan(15);
    expect(tiltOf('walk', 0.3)).toBeLessThan(25);
    expect(tiltOf('run', 0.2)).toBeGreaterThan(15);
    expect(tiltOf('run', 0.2)).toBeLessThan(25);
    expect(tiltOf('cheer', 1.0)).toBeLessThan(10);
  });
});

describe('Rama GLB: planted feet in motion', () => {
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
