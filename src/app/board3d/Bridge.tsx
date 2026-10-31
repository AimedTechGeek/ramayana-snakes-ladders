// The nine arched stone bridges (T44 6.2-6.5). A bridge is not in the scene until a token lands on its foot square
// (the GLB is not even requested before; preloadBridges warms the cache in idle time). Then its chunks rise one after
// another from the foot (6.4), and it fades to 0.35 while a token stands under the deck. One merged mesh per bridge,
// one draw call; the rise runs in the vertex shader from the vertex position along the route, so no per-chunk meshes.

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { DoubleSide, Mesh, MeshStandardMaterial, type BufferGeometry, type WebGLProgramParametersWithUniforms } from 'three';
import type { StoryJump } from '../../core/boards';
import { bridgeById, type Bridge as BridgeData } from './bridgeGeometry';
import {
  CHUNK_RISE_MS,
  CHUNK_STAGGER_MS,
  RISE_DEPTH,
  RISE_SQUASH,
  fadeTarget,
  riseClock,
  riseTotalMs,
  stepOpacity,
  thudScale,
} from './bridgeLook';
import { isPhoneWidth } from './cameraConfig';
import type { DioramaView } from './DioramaView';

export const bridgeUrl = (id: string): string => `${import.meta.env.BASE_URL}models/bridges/${id}.glb`;

/** Warms the GLB cache for every bridge of the level without blocking anything. */
export function preloadBridges(ids: readonly string[]): void {
  for (const id of ids) useGLTF.preload(bridgeUrl(id), false);
}

type Shader = WebGLProgramParametersWithUniforms;

/** Clay stone with the rise built in: a chunk sinks, squashes and turns transparent until `uClock` reaches it. */
function bridgeMaterial(bridge: BridgeData): { material: MeshStandardMaterial; uniforms: { uClock: { value: number } } } {
  const dx = bridge.top[0] - bridge.foot[0];
  const dz = bridge.top[1] - bridge.foot[1];
  const chord = Math.hypot(dx, dz);
  const uniforms = {
    uClock: { value: 1e6 },
    uFoot: { value: [bridge.foot[0], bridge.foot[1]] },
    uAlong: { value: [dx / chord, dz / chord] },
    uChord: { value: chord },
    uChunks: { value: bridge.openings },
    uBase: { value: bridge.baseFoot },
  };
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide, flatShading: true });
  material.onBeforeCompile = (shader: Shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uClock; uniform vec2 uFoot; uniform vec2 uAlong; uniform float uChord; uniform float uChunks; uniform float uBase;
        varying float vRise;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float chunk = floor(clamp(dot(position.xz - uFoot, uAlong) / uChord, 0.0, 0.9999) * uChunks);
        float t = clamp((uClock - chunk * ${CHUNK_STAGGER_MS.toFixed(1)}) / ${CHUNK_RISE_MS.toFixed(1)}, 0.0, 1.0);
        float e = 1.0 + 2.70158 * pow(t - 1.0, 3.0) + 1.70158 * pow(t - 1.0, 2.0);
        transformed.y = uBase + (transformed.y - uBase) * mix(${RISE_SQUASH.toFixed(2)}, 1.0, e) - ${RISE_DEPTH.toFixed(2)} * (1.0 - e);
        vRise = t;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRise;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vRise;');
  };
  return { material, uniforms };
}

function BridgePiece({ view, jump, bridge }: { view: DioramaView; jump: StoryJump; bridge: BridgeData }) {
  const gltf = useGLTF(bridgeUrl(bridge.id), false);
  const geometry = useMemo<BufferGeometry | null>(() => {
    let found: BufferGeometry | null = null;
    gltf.scene.traverse((node) => {
      if (!found && node instanceof Mesh) found = node.geometry;
    });
    // the GLB carries no normals (flat shading needs none), but the shadow-map vertex code offsets along the normal
    (found as BufferGeometry | null)?.computeVertexNormals();
    return found;
  }, [gltf]);
  const { material, uniforms } = useMemo(() => bridgeMaterial(bridge), [bridge]);
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useRef<Mesh>(null);
  const opacity = useRef(1);
  const total = riseTotalMs(bridge.openings);
  const pivot = useMemo<[number, number, number]>(() => {
    const mid = bridge.deck[bridge.deck.length >> 1]!;
    return [mid.x, bridge.baseFoot, mid.z];
  }, [bridge]);
  const shadows = useMemo(() => !isPhoneWidth(window.innerWidth), []);

  useFrame((_, delta) => {
    const node = mesh.current;
    if (!node) return;
    const rise = view.jumpRise.get(jump.from) ?? 0;
    node.visible = rise > 0;
    const u = riseClock(rise);
    uniforms.uClock.value = rise >= 1 ? 1e6 : u * total;
    // fade-when-behind: a token standing under the deck (a crossing token is on it, not under it)
    const spots = view.tokens.flatMap((token) => (token.override === null ? [token.spot] : []));
    opacity.current = stepOpacity(opacity.current, fadeTarget(bridge.crossed, spots), delta * 1000);
    material.opacity = opacity.current;
    const faded = opacity.current < 1;
    const rising = rise < 1;
    if (material.transparent !== (faded || rising)) {
      material.transparent = faded || rising;
      material.needsUpdate = true;
    }
    // an already standing bridge gives a small thud when a token lands on its foot
    const thudAt = view.thuds.get(jump.from);
    const s = thudAt === undefined ? 1 : thudScale(performance.now() - thudAt);
    // the mesh holds board coordinates: scale about the bridge's own centre, not the board origin
    node.scale.set(s, s, s);
    node.position.set(pivot[0] * (1 - s), pivot[1] * (1 - s), pivot[2] * (1 - s));
  });

  if (!geometry) return null;
  return (
    <mesh
      ref={mesh}
      name={`bridge-${bridge.id}`}
      geometry={geometry}
      material={material}
      castShadow={shadows}
      receiveShadow
      frustumCulled={false}
      visible={false}
    />
  );
}

/** Every revealed bridge of the board; a bridge mounts (and loads) when its jump first appears in `view.jumpRise`. */
export function Bridges({ view }: { view: DioramaView }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const ladders = useMemo(() => view.setup?.board.ladders ?? [], [view.setup]);
  useEffect(() => {
    const ids = ladders.map((ladder) => ladder.id);
    const warm = (): void => preloadBridges(ids);
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, [ladders]);
  return (
    <group name="bridges">
      {ladders.map((jump) => {
        const bridge = bridgeById(jump.id);
        if (!bridge || !view.jumpRise.has(jump.from)) return null;
        return (
          <Suspense key={jump.from} fallback={null}>
            <BridgePiece view={view} jump={jump} bridge={bridge} />
          </Suspense>
        );
      })}
    </group>
  );
}
