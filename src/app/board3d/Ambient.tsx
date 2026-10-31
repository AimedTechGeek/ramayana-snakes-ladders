// Ambient life (T44 2.6): lamp and fire flicker with additive glow sprites, chimney and fire smoke, butterflies over
// Mithila, birds on row-band loops, dust motes. Culled: a block's ambience runs only while the block is revealed and
// inside the camera frustum plus one block (list rebuilt every 250 ms). Under `prefers-reduced-motion` all of it is off
// (sway and shimmer are switched off by the shared `uMotion` uniform in scenery.ts). Water shaders belong to the board.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Frustum,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  Sphere,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import {
  activeSquares,
  ambientFeatures,
  BIRD_LOOP_SECONDS,
  BIRD_ROUTES,
  birdPose,
  blockCentre,
  BUTTERFLY_COUNT,
  defaultBlockTopY,
  glowSpots,
  MITHILA_SQUARES,
  smokeSpots,
  squaresOfRows,
} from './propLayout';
import {
  easeToward,
  kindGeometry,
  sceneryMaterials,
  sceneryUniforms,
  useReducedMotion,
  usePropsScene,
} from './scenery';
import type { SceneryProps } from './Props';

/** Frustum test radius: half a block diagonal plus one block of margin. */
const CULL_RADIUS = Math.SQRT1_2 + 1;
const CULL_MS = 250;
const FLICKER_MIN_MS = 80;
const FLICKER_MAX_MS = 140;

// ---------------------------------------------------------------- culling

/** Squares that are revealed and inside the frustum + 1 block, rebuilt every 250 ms. */
function useActiveSquares(revealed: ReadonlySet<number>): RefObject<Set<number>> {
  const camera = useThree((state) => state.camera);
  const active = useRef<Set<number>>(new Set());
  useEffect(() => {
    const frustum = new Frustum();
    const matrix = new Matrix4();
    const sphere = new Sphere(undefined, CULL_RADIUS);
    const rebuild = (): void => {
      camera.updateMatrixWorld();
      matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(matrix);
      active.current = activeSquares(revealed, (square) => {
        const [x, z] = blockCentre(square);
        sphere.center.set(x, 0.3, z);
        return frustum.intersectsSphere(sphere);
      });
    };
    rebuild();
    const id = window.setInterval(rebuild, CULL_MS);
    return () => window.clearInterval(id);
  }, [camera, revealed]);
  return active;
}

// ---------------------------------------------------------------- sprite clouds (one Points draw each)

function softSprite(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

interface CloudBuffers {
  position: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
}

interface CloudProps {
  count: number;
  color: string;
  additive: boolean;
  /** Fills the buffers for time `t` (seconds); the cloud uploads them after. */
  fill: (buffers: CloudBuffers, t: number, delta: number) => void;
}

const CLOUD_VERTEX = `
  uniform float uScale;
  attribute float aAlpha;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.001, -mv.z);
    vAlpha = aAlpha;
  }`;
const CLOUD_FRAGMENT = `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

function Cloud({ count, color, additive, fill }: CloudProps) {
  const points = useRef<Points>(null);
  const clock = useRef(0);
  const sprite = useMemo(softSprite, []);
  const { geometry, buffers } = useMemo(() => {
    const data: CloudBuffers = {
      position: new Float32Array(count * 3),
      alpha: new Float32Array(count),
      size: new Float32Array(count),
    };
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.position, 3));
    g.setAttribute('aAlpha', new BufferAttribute(data.alpha, 1));
    g.setAttribute('aSize', new BufferAttribute(data.size, 1));
    return { geometry: g, buffers: data };
  }, [count]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uScale: { value: 500 }, uMap: { value: sprite }, uColor: { value: new Color(color) } },
        vertexShader: CLOUD_VERTEX,
        fragmentShader: CLOUD_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: additive ? AdditiveBlending : NormalBlending,
      }),
    [sprite, color, additive],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      sprite.dispose();
    },
    [geometry, material, sprite],
  );
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  useFrame((_, delta) => {
    clock.current += delta;
    fill(buffers, clock.current, delta);
    for (const name of ['position', 'aAlpha', 'aSize'] as const)
      geometry.getAttribute(name).needsUpdate = true;
    const fov = (camera as PerspectiveCamera).fov ?? 40;
    material.uniforms.uScale!.value = gl.domElement.height / (2 * Math.tan((fov * Math.PI) / 360));
  });
  return (
    <points ref={points} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />
  );
}

// ---------------------------------------------------------------- flames and smoke

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const FLAME_SIZE = 0.14;
const FLAME_ALPHA = 0.35;

function Flames({ revealed, blockTopY, active }: ActiveProps) {
  const spots = useMemo(() => glowSpots(blockTopY), [blockTopY]);
  const levels = useRef(spots.map(() => ({ level: 1, until: 0 })));
  const global = useRef({ level: 1, until: 0 });
  const glow = sceneryMaterials().glow;
  useEffect(() => () => void glow.color.setScalar(1), [glow]);
  const fill = (b: CloudBuffers, t: number): void => {
    const now = t * 1000;
    let anyActive = false;
    spots.forEach((spot, i) => {
      const state = levels.current[i]!;
      const on = active.current?.has(spot.square) && revealed.has(spot.square);
      if (on) anyActive = true;
      if (now >= state.until) {
        state.level = 0.75 + 0.25 * Math.random();
        state.until = now + FLICKER_MIN_MS + Math.random() * (FLICKER_MAX_MS - FLICKER_MIN_MS);
      }
      b.position.set(spot.position, i * 3);
      b.alpha[i] = on ? FLAME_ALPHA * state.level : 0;
      b.size[i] = FLAME_SIZE * (0.92 + 0.12 * state.level);
    });
    if (now >= global.current.until) {
      global.current.level = anyActive ? 0.75 + 0.25 * Math.random() : 1;
      global.current.until = now + FLICKER_MIN_MS + Math.random() * (FLICKER_MAX_MS - FLICKER_MIN_MS);
      glow.color.setScalar(global.current.level);
    }
  };
  return <Cloud count={spots.length} color="#F39C2B" additive fill={fill} />;
}

const SMOKE_PER_EMITTER = 4;
const SMOKE_RISE = 0.3;
const SMOKE_SECONDS = 1.6;
const SMOKE_ALPHA = 0.4;

function Smoke({ revealed, blockTopY, active }: ActiveProps) {
  const spots = useMemo(() => smokeSpots(blockTopY), [blockTopY]);
  const fill = (b: CloudBuffers, t: number): void => {
    spots.forEach((spot, e) => {
      const on = active.current?.has(spot.square) && revealed.has(spot.square);
      for (let p = 0; p < SMOKE_PER_EMITTER; p++) {
        const i = e * SMOKE_PER_EMITTER + p;
        const age = (t / SMOKE_SECONDS + p / SMOKE_PER_EMITTER + hash(e)) % 1;
        const [x, y, z] = spot.position;
        b.position[i * 3] = x + Math.sin(t * 1.3 + i) * 0.025 * age;
        b.position[i * 3 + 1] = y + age * SMOKE_RISE;
        b.position[i * 3 + 2] = z;
        b.alpha[i] = on ? SMOKE_ALPHA * (1 - age) * Math.min(1, age * 8) : 0;
        b.size[i] = 0.06 + 0.1 * age;
      }
    });
  };
  return (
    <Cloud
      count={Math.max(1, spots.length * SMOKE_PER_EMITTER)}
      color="#E8E5EE"
      additive={false}
      fill={fill}
    />
  );
}

const MOTE_COUNT = 48;

function Motes() {
  const base = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => [
        hash(i) * 12 - 6,
        0.15 + hash(i + 50) * 1.4,
        hash(i + 99) * 12 - 6,
      ]),
    [],
  );
  const fill = (b: CloudBuffers, t: number): void => {
    base.forEach(([x, y, z], i) => {
      b.position[i * 3] = x! + Math.sin(t * 0.13 + i) * 0.35;
      b.position[i * 3 + 1] = y! + Math.sin(t * 0.21 + i * 2) * 0.12;
      b.position[i * 3 + 2] = z! + Math.cos(t * 0.11 + i) * 0.35;
      b.alpha[i] = 0.22 * (0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.7));
      b.size[i] = 0.035;
    });
  };
  return <Cloud count={MOTE_COUNT} color="#FFF6DC" additive fill={fill} />;
}

// ---------------------------------------------------------------- winged things

function patchFlap(hertz: number) {
  return (shader: WebGLProgramParametersWithUniforms): void => {
    Object.assign(shader.uniforms, sceneryUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float flapPhase = instanceMatrix[3].x * 5.0 + instanceMatrix[3].z * 3.0;
        #else
          float flapPhase = 0.0;
        #endif
        transformed.y += abs(position.x) * sin(uTime * ${(hertz * Math.PI * 2).toFixed(3)} + flapPhase) * 0.9 * uMotion;`,
      );
  };
}

function wingMaterial(hertz: number): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: 2 });
  material.onBeforeCompile = patchFlap(hertz);
  return material;
}

interface ActiveProps extends SceneryProps {
  blockTopY: NonNullable<SceneryProps['blockTopY']>;
  active: RefObject<Set<number>>;
}

function Butterflies({ revealed, blockTopY, active }: ActiveProps) {
  const mesh = useRef<InstancedMesh>(null);
  const scene = usePropsScene();
  const geometry = kindGeometry(scene, 'butterfly').body;
  const material = useMemo(() => wingMaterial(8), []);
  const shown = useRef(new Float32Array(BUTTERFLY_COUNT));
  const dummy = useMemo(() => new Object3D(), []);
  const clock = useRef(0);
  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const hues = ['#F8D56B', '#F3A9BB', '#9CCBF0', '#F6A33B', '#C7B2F0', '#FFFFFF'];
    hues.forEach((hue, i) => instanced.setColorAt(i, new Color(hue)));
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [geometry]);
  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    clock.current += delta;
    const t = clock.current;
    const homes = MITHILA_SQUARES.filter((s) => revealed.has(s) && active.current?.has(s));
    const stride = Math.max(1, Math.floor(homes.length / BUTTERFLY_COUNT));
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      const home = homes.length > 0 ? homes[(i * stride) % homes.length] : undefined;
      shown.current[i] = easeToward(shown.current[i]!, home ? 1 : 0, delta);
      if (home) {
        const [cx, cz] = blockCentre(home);
        const theta = t * 0.9 + i * 1.7;
        dummy.position.set(
          cx + Math.sin(theta) * 0.3,
          blockTopY(home) + 0.3 + 0.05 * Math.sin(t * 2.1 + i),
          cz + Math.sin(2 * theta) * 0.15,
        );
        dummy.rotation.set(0, Math.atan2(Math.cos(theta) * 0.3, Math.cos(2 * theta) * 0.3), 0);
      }
      dummy.scale.setScalar(Math.max(shown.current[i]!, 0.0001) * 1.4);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
  });
  if (!geometry) return null;
  return (
    <instancedMesh
      ref={mesh}
      name="butterflies"
      args={[geometry, material, BUTTERFLY_COUNT]}
      frustumCulled={false}
    />
  );
}

function Birds({ revealed, blockTopY, active }: ActiveProps) {
  const mesh = useRef<InstancedMesh>(null);
  const scene = usePropsScene();
  const geometry = kindGeometry(scene, 'bird').body;
  const material = useMemo(() => wingMaterial(6), []);
  const shown = useRef(new Float32Array(BIRD_ROUTES.length));
  const dummy = useMemo(() => new Object3D(), []);
  const clock = useRef(0);
  const bands = useMemo(() => BIRD_ROUTES.map((route) => squaresOfRows(route.rows[0], route.rows[1])), []);
  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    BIRD_ROUTES.forEach((route, i) => instanced.setColorAt(i, new Color(route.tint)));
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [geometry]);
  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    clock.current += delta;
    BIRD_ROUTES.forEach((route, i) => {
      const band = bands[i]!;
      const on = band.some((s) => revealed.has(s) && active.current?.has(s));
      shown.current[i] = easeToward(shown.current[i]!, on ? 1 : 0, delta);
      const pose = birdPose(route, clock.current);
      dummy.position.set(
        pose.x,
        blockTopY(band[0]!) + route.height + 0.04 * Math.sin(clock.current * 1.7 + i),
        pose.z,
      );
      dummy.rotation.set(0, pose.yaw, 0);
      dummy.scale.setScalar(Math.max(shown.current[i]!, 0.0001) * route.scale);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  });
  if (!geometry) return null;
  return (
    <instancedMesh
      ref={mesh}
      name={`birds-${BIRD_LOOP_SECONDS}s`}
      args={[geometry, material, BIRD_ROUTES.length]}
      frustumCulled={false}
    />
  );
}

// ---------------------------------------------------------------- root

export function Ambient({ revealed, blockTopY = defaultBlockTopY }: SceneryProps) {
  const reduced = useReducedMotion();
  const features = ambientFeatures(reduced);
  const active = useActiveSquares(revealed);
  if (reduced) return null;
  const shared = { revealed, blockTopY, active };
  return (
    <group name="ambient">
      {features.flicker && <Flames {...shared} />}
      {features.smoke && <Smoke {...shared} />}
      {features.butterflies && <Butterflies {...shared} />}
      {features.birds && <Birds {...shared} />}
      {features.motes && <Motes />}
    </group>
  );
}
