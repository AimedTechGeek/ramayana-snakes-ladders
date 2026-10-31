// Shared look of the scenery: the vertex-coloured clay materials (one per animation class), the flame material,
// the shared clock, the reduced-motion switch and the GLB lookups. Props, Landmarks and Ambient all read these.

import { useSyncExternalStore } from 'react';
import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { useGLTF } from '@react-three/drei';

export const PROPS_URL = `${import.meta.env.BASE_URL}models/props/props.glb`;
export const LANDMARKS_URL = `${import.meta.env.BASE_URL}models/props/landmarks.glb`;

/** One clock and one motion switch for every scenery shader (sway, shimmer, flow, wing flap). */
export const sceneryUniforms = {
  uTime: { value: 0 },
  /** 1 = animated, 0 = static (prefers-reduced-motion). */
  uMotion: { value: 1 },
};

// ---------------------------------------------------------------- reduced motion

const QUERY = '(prefers-reduced-motion: reduce)';

let list: MediaQueryList | null | undefined;

function mediaList(): MediaQueryList | null {
  list ??=
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY)
      : null;
  return list;
}

export function prefersReducedMotion(): boolean {
  return mediaList()?.matches ?? false;
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = mediaList();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
}

// ---------------------------------------------------------------- materials

type Shader = WebGLProgramParametersWithUniforms;
const SWAY_AMPLITUDE = 0.015;
const SWAY_HEIGHT = 0.3;

function patchSway(shader: Shader): void {
  Object.assign(shader.uniforms, sceneryUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uMotion;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float swayPhase = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 4.7;
      #else
        float swayPhase = 0.0;
      #endif
      float swayW = 2.4 + fract(swayPhase) * 1.1;
      float swayH = clamp(position.y / ${SWAY_HEIGHT.toFixed(2)}, 0.0, 1.0);
      transformed.x += sin(uTime * swayW + swayPhase) * ${SWAY_AMPLITUDE} * swayH * uMotion;
      transformed.z += cos(uTime * swayW * 0.8 + swayPhase) * ${SWAY_AMPLITUDE} * swayH * uMotion;`,
    );
}

function patchShimmer(shader: Shader): void {
  Object.assign(shader.uniforms, sceneryUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vShimmer;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vShimmer = instanceMatrix[3].x * 2.3 + instanceMatrix[3].z * 1.7 + position.y * 9.0;
      #else
        vShimmer = position.y * 9.0;
      #endif`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;\nuniform float uMotion;\nvarying float vShimmer;',
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + 0.09 * sin(uTime * 2.1 + vShimmer) * uMotion;`,
    );
}

/** Waterfall strip: bright bands that scroll down at 0.6 u/s. */
function patchFlow(shader: Shader): void {
  Object.assign(shader.uniforms, sceneryUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vFlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = position.y;');
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;\nuniform float uMotion;\nvarying float vFlow;',
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= 0.9 + 0.1 * sin(63.0 * (vFlow + uTime * 0.6 * uMotion));`,
    );
}

export interface SceneryMaterials {
  still: MeshStandardMaterial;
  sway: MeshStandardMaterial;
  shimmer: MeshStandardMaterial;
  /** Flame / lamp glass: unlit, brightness set by Ambient's flicker. */
  glow: MeshBasicMaterial;
  flow: MeshBasicMaterial;
}

function clay(patch?: (shader: Shader) => void): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: DoubleSide,
  });
  if (patch) material.onBeforeCompile = patch;
  return material;
}

let shared: SceneryMaterials | undefined;

export function sceneryMaterials(): SceneryMaterials {
  shared ??= {
    still: clay(),
    sway: clay(patchSway),
    shimmer: clay(patchShimmer),
    glow: new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      toneMapped: false,
      color: new Color(1, 1, 1),
    }),
    flow: Object.assign(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, toneMapped: false }), {
      onBeforeCompile: patchFlow,
    }),
  };
  return shared;
}

/** Body material of a kind from its manifest `anim` class. */
export function bodyMaterial(anim: string): Material {
  const m = sceneryMaterials();
  if (anim === 'sway') return m.sway;
  if (anim === 'shimmer') return m.shimmer;
  return m.still;
}

/** Glow material of a kind: the waterfall strip scrolls, every other glow flickers. */
export function glowMaterial(kind: string): Material {
  const m = sceneryMaterials();
  return kind === 'waterfall' ? m.flow : m.glow;
}

// ---------------------------------------------------------------- GLB lookups

export interface KindGeometry {
  body?: BufferGeometry;
  glow?: BufferGeometry;
}

function geometryOf(scene: Object3D, name: string): BufferGeometry | undefined {
  const node = scene.getObjectByName(name) as Mesh | undefined;
  return node?.isMesh ? node.geometry : undefined;
}

export function kindGeometry(scene: Object3D, kind: string): KindGeometry {
  return { body: geometryOf(scene, kind), glow: geometryOf(scene, `${kind}__glow`) };
}

export function usePropsScene(): Object3D {
  return useGLTF(PROPS_URL).scene;
}

export function useLandmarksScene(): Object3D {
  return useGLTF(LANDMARKS_URL).scene;
}

/** Smooth pop-in: 0 -> 1 with a small overshoot. */
export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Fraction of the remaining blend covered per second while a prop grows in or out. */
export const REVEAL_RATE = 4.5;

export function easeToward(now: number, target: number, delta: number): number {
  if (Math.abs(target - now) < 0.004) return target;
  return now + (target - now) * Math.min(1, delta * REVEAL_RATE);
}
