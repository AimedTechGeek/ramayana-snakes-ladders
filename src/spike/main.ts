// D3 spike page: loads the Blender-generated Hanuman GLB (meshopt) with plain three.js and plays idle / walk.
// Query params: ?mode=idle|walk  ?cam=front|three|orbit  ?model=<url>
import {
  AnimationAction,
  AnimationMixer,
  Bone,
  CylinderGeometry,
  Clock,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

type Mode = 'idle' | 'walk';

const PATH_RADIUS = 0.9; // metres: the character walks a circle (character is 1.0 tall)
const params = new URLSearchParams(location.search);
const stage = document.getElementById('stage') as HTMLDivElement;
const hud = document.getElementById('hud') as HTMLDivElement;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = NeutralToneMapping;
renderer.toneMappingExposure = 0.9;
stage.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color('#8d9acb');
const pmrem = new PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

scene.add(new HemisphereLight('#f4f0ff', '#b9a98f', 0.55));
const sun = new DirectionalLight('#fff1dc', 2.2);
sun.position.set(2.2, 3.6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 5;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.01;
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 10 });
scene.add(sun);

// soft ground: a pastel clay disc that receives the shadow
const ground = new Mesh(
  new CylinderGeometry(1.7, 1.75, 0.14, 72),
  new MeshStandardMaterial({ color: '#c3bcdc', roughness: 0.95 }),
);
ground.position.y = -0.07;
ground.receiveShadow = true;
scene.add(ground);

const camera = new PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.45, 0);
controls.enableDamping = true;

const CAMS: Record<string, [number, number, number]> = {
  front: [0, 0.6, 1.9],
  close: [0.5, 0.75, 1.3],
  three: [1.5, 1.0, 2.0],
  orbit: [-1.9, 0.9, 1.1],
  walk: [0.5, 0.9, 2.3],
};
function setCamera(name: string): void {
  const p = CAMS[name] ?? CAMS.three!;
  camera.position.set(...p);
  controls.update();
}
setCamera(params.get('cam') ?? 'walk');

// ---------------------------------------------------------------- model + clips
const holder = new Group(); // moved along the path; the GLB root sits inside
scene.add(holder);
let mixer: AnimationMixer | undefined;
const actions: Partial<Record<Mode, AnimationAction>> = {};
let mode: Mode = params.get('mode') === 'idle' ? 'idle' : 'walk';
let walkSpeed = 0.5; // metres/s, read from the GLB (armature extras)
let stats = { triangles: 0, bones: 0, clips: [] as string[], loadMs: 0 };
let pathAngle = 0;
let travel = true;
const footBones: Bone[] = [];

function triangleCount(root: Group): number {
  let tris = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position!.count) / 3;
    }
  });
  return tris;
}

async function load(): Promise<void> {
  const t0 = performance.now();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const url = params.get('model') ?? `${import.meta.env.BASE_URL}models/spike/hanuman.glb`;
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // skinned bounds are the bind pose; clips move far from it
    }
    if ((o as Bone).isBone && /^foot[LR]$/.test(o.name)) footBones.push(o as Bone);
  });
  holder.add(root);
  const extras = root.children.find((c) => c.userData && c.userData.walk_speed_mps);
  if (extras) walkSpeed = Number(extras.userData.walk_speed_mps);
  mixer = new AnimationMixer(root);
  for (const clip of gltf.animations) {
    if (clip.name === 'idle' || clip.name === 'walk') {
      const a = mixer.clipAction(clip);
      a.setLoop(LoopRepeat, Infinity);
      actions[clip.name] = a;
    }
  }
  let bones = 0;
  root.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) bones = (o as SkinnedMesh).skeleton.bones.length;
  });
  stats = {
    triangles: triangleCount(root),
    bones,
    clips: gltf.animations.map((a) => `${a.name}:${a.duration.toFixed(2)}s`),
    loadMs: Math.round(performance.now() - t0),
  };
  setMode(mode, true);
}

function setMode(next: Mode, instant = false): void {
  const from = actions[mode];
  const to = actions[next];
  mode = next;
  if (to) {
    to.reset().play();
    if (from && from !== to && !instant) to.crossFadeFrom(from, 0.25, false);
    else if (from && from !== to) from.stop();
  }
  (document.getElementById('btn-idle') as HTMLElement).setAttribute('aria-pressed', String(next === 'idle'));
  (document.getElementById('btn-walk') as HTMLElement).setAttribute('aria-pressed', String(next === 'walk'));
}
document.getElementById('btn-idle')!.addEventListener('click', () => setMode('idle'));
document.getElementById('btn-walk')!.addEventListener('click', () => setMode('walk'));

// ---------------------------------------------------------------- loop
const clock = new Clock();
let frames = 0;
let fpsWindowStart = performance.now();
let fps = 0;
let fixedDt: number | null = null;

function placeOnPath(): void {
  holder.position.set(Math.sin(pathAngle) * PATH_RADIUS, 0, Math.cos(pathAngle) * PATH_RADIUS - PATH_RADIUS);
  // heading = tangent of the circle (GLB faces +Z)
  holder.rotation.y = pathAngle + Math.PI / 2;
}

function step(dt: number): void {
  if (mode === 'walk' && travel) {
    const before = holder.position.clone();
    pathAngle += (walkSpeed * dt) / PATH_RADIUS;
    placeOnPath();
    const moved = holder.position.clone().sub(before); // the camera follows the walker
    camera.position.add(moved);
    controls.target.add(moved);
  }
  mixer?.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

function frame(): void {
  const dt = fixedDt ?? Math.min(clock.getDelta(), 0.1);
  step(dt);
  frames++;
  const now = performance.now();
  if (now - fpsWindowStart >= 1000) {
    fps = (frames * 1000) / (now - fpsWindowStart);
    frames = 0;
    fpsWindowStart = now;
    hud.textContent = `${mode}  ${fps.toFixed(0)} fps  ${stats.triangles} tris  ${stats.bones} bones  ${stats.clips.join(' ')}`;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- test hooks (playwright)
const tmp = new Vector3();
interface SpikeApi {
  ready: boolean;
  stats: () => typeof stats & { fps: number; walkSpeed: number };
  setMode: (m: Mode) => void;
  setCamera: (name: string) => void;
  /** Freeze the sim at clip time t (seconds) in `m`, path angle a; renders one frame. */
  pose: (m: Mode, t: number, angle?: number) => void;
  /** Ankle world position per foot for clip time t, character walking in a straight line at walkSpeed. */
  footSamples: (frames: number) => { t: number; L: number[]; R: number[] }[];
  cycleSeconds: () => number;
}
const api: SpikeApi = {
  ready: false,
  stats: () => ({ ...stats, fps, walkSpeed }),
  setMode: (m) => setMode(m, true),
  setCamera,
  pose: (m, t, angle = 0) => {
    fixedDt = 0;
    setMode(m, true);
    travel = false;
    for (const a of Object.values(actions)) a.paused = false;
    pathAngle = angle;
    mixer!.setTime(t);
    holder.position.set(0, 0, 0);
    holder.rotation.y = 0.35;
    controls.update();
    renderer.render(scene, camera);
  },
  footSamples: (n) => {
    const a = actions.walk!;
    setMode('walk', true);
    holder.position.set(0, 0, 0);
    holder.rotation.set(0, 0, 0);
    const dur = a.getClip().duration;
    const out: { t: number; L: number[]; R: number[] }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (dur * i) / n;
      mixer!.setTime(t);
      holder.updateMatrixWorld(true);
      const rec: { t: number; L: number[]; R: number[] } = { t, L: [], R: [] };
      for (const b of footBones) {
        b.getWorldPosition(tmp);
        // simulate the straight-line travel (+Z) at walkSpeed
        tmp.z += walkSpeed * t;
        (b.name === 'footL' ? rec.L : rec.R).push(tmp.x, tmp.y, tmp.z);
      }
      out.push(rec);
    }
    return out;
  },
  cycleSeconds: () => actions.walk!.getClip().duration,
};
(window as unknown as { __spike: SpikeApi }).__spike = api;

load()
  .then(() => {
    api.ready = true;
    frame();
  })
  .catch((e) => {
    hud.textContent = `load failed: ${String(e)}`;
    console.error(e);
  });
