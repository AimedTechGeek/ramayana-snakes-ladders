// A clay hero on the board (T44 4): the skinned GLB with its nine clips, a clip player, distance-driven walk and run
// (the mixer time comes from the distance travelled over the GLB's stride, so the feet never slide), eased facing,
// the six-frame face with blinking, a saffron ground ring for the current player and a soft blob shadow.
//
//   const hero = useRef<HeroHandle>(null);
//   <Hero ref={hero} hero="hanuman" lit />            // then hero.current.play('happy'), .setLocomotion('walk', d) ...
//   useHeroActor(hero, view, player)                  // drives it from DioramaView (see heroDirector.ts for the mapping)

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import {
  AnimationAction,
  AnimationMixer,
  CanvasTexture,
  Group,
  LoopOnce,
  LoopRepeat,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
} from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Emotion } from '../../characters/reactions';
import { CELL } from '../../game/iso/world';
import type { DioramaView } from './DioramaView';
import {
  BLINK_MS,
  CROSSFADE_MS,
  clipSeconds,
  clipTimeAtPhase,
  clipWeight,
  easeYaw,
  fadeBetween,
  faceFrameOf,
  isDistanceDriven,
  isLooping,
  leapClipTime,
  nextBlinkInMs,
  phaseFromDistance,
  type Beats,
  type HeroClip,
} from './heroClips';
import { HeroDirector } from './heroDirector';
import { faceTextureFor, showFrame } from './heroFace';

export type HeroId = 'hanuman';

export interface PlayOptions {
  /** Defaults: idle, walk, run, cheer loop; the rest play once and hold their last pose. */
  loop?: boolean;
  fadeMs?: number;
  /** Intensity 0..1 of an emotion clip: weight 0.5 + 0.5 i blended over idle (T44 4.6). */
  intensity?: number;
}

export interface HeroHandle {
  /** Crossfade to a clip (150 ms; never between walk and run). */
  play(clip: HeroClip, options?: PlayOptions): void;
  /** Show `gait` at the phase of `distance` board units walked since the move began (no free-running). */
  setLocomotion(gait: 'walk' | 'run', distance: number): void;
  /** Show the leap `ms` into its four beats (anticipation, takeoff, flight, land). */
  leap(ms: number, beats: Beats): void;
  /** Heading in radians (0 faces +z, the viewer). Eased over 120 ms unless `snap`. */
  setFacing(yaw: number, snap?: boolean): void;
  setEmotion(emotion: Emotion): void;
  setLit(lit: boolean): void;
  /** Freeze the rig exactly at `time` seconds of `clip` (test and preview hook). */
  sample(clip: HeroClip, time: number): void;
  /** Evaluate the rig now (the next frame does anyway); lets tests read bone positions right after a set. */
  settle(): void;
  readonly clip: HeroClip | null;
  readonly root: Object3D;
  /** GLB extras: stride of one walk / run cycle in board units. */
  readonly stride: { walk: number; run: number };
}

export interface HeroProps {
  hero: HeroId;
  ref?: Ref<HeroHandle>;
  lit?: boolean;
  emotion?: Emotion;
  reducedMotion?: boolean;
  /** Blink every 3-5 s at idle (default true; the preview turns it off for stills). */
  blink?: boolean;
}

const url = (hero: HeroId): string => `${import.meta.env.BASE_URL}models/heroes/${hero}.glb`;
export const preloadHero = (hero: HeroId): void => useGLTF.preload(url(hero), false, true);

/** The walk bob is at most 0.08; the 360 ms entry arc peaks at 0.6: above this the token is on the arc. */
const ENTRY_ARC_LIFT = 0.1;
const RING_RADIUS = 0.26;
const RING_WIDTH = 0.03;
const PULSE_MS = 1200;
let blobTexture: CanvasTexture | null = null;

/** Radial soft blob, one texture for every hero (the board has one ContactShadows, heroes use this decal). */
export function blob(): CanvasTexture {
  if (blobTexture) return blobTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(60,50,110,0.55)');
    grad.addColorStop(1, 'rgba(60,50,110,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  blobTexture = new CanvasTexture(canvas);
  return blobTexture;
}

interface Extras {
  walk: number;
  run: number;
}

function readExtras(root: Object3D): Extras {
  const extras: Extras = { walk: 32 / CELL, run: 56 / CELL };
  root.traverse((o) => {
    const data = o.userData as Record<string, unknown>;
    if (typeof data.stride_m === 'number') extras.walk = data.stride_m;
    if (typeof data.run_stride_m === 'number') extras.run = data.run_stride_m;
  });
  return extras;
}

export function Hero({
  hero,
  ref,
  lit = false,
  emotion = 'idle',
  reducedMotion = false,
  blink = true,
}: HeroProps) {
  const gltf = useGLTF(url(hero), false, true);
  const outer = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const state = useRef({
    clip: null as HeroClip | null,
    action: null as AnimationAction | null,
    yaw: 0,
    targetYaw: 0,
    snap: false,
    emotion,
    lit,
    blinkAt: performance.now() + nextBlinkInMs(Math.random()),
    blinkUntil: 0,
    reduced: reducedMotion,
    weight: 1,
  });
  state.current.lit = lit;
  state.current.reduced = reducedMotion;

  const rig = useMemo(() => {
    const root = clone(gltf.scene) as Group;
    const mixer = new AnimationMixer(root);
    const actions = new Map<HeroClip, AnimationAction>();
    for (const clip of gltf.animations) actions.set(clip.name as HeroClip, mixer.clipAction(clip));
    const face = faceTextureFor();
    const owned: Material[] = [];
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned bounds are the bind pose; leaps and the somersault leave it
      const material = mesh.material as MeshStandardMaterial;
      if (material.name === 'face') {
        const own = material.clone();
        own.map = face;
        own.transparent = true;
        own.depthWrite = false;
        own.polygonOffset = true;
        own.polygonOffsetFactor = -2;
        mesh.material = own;
        mesh.castShadow = false;
        owned.push(own);
      }
    });
    return { root, mixer, actions, face, owned, extras: readExtras(gltf.scene) };
  }, [gltf]);

  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
      rig.face.dispose();
      rig.owned.forEach((m) => m.dispose());
    },
    [rig],
  );

  const handle = useMemo<HeroHandle>(() => {
    const s = state.current;
    const activate = (
      clip: HeroClip,
      fadeMs: number,
      loop: boolean,
      weight: number,
    ): AnimationAction | null => {
      const action = rig.actions.get(clip);
      if (!action) return null;
      const from = s.action;
      if (from === action && s.clip === clip) return action;
      action.reset();
      action.enabled = true;
      action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      action.setEffectiveTimeScale(isDistanceDriven(clip) ? 0 : 1);
      action.setEffectiveWeight(weight);
      action.play();
      const fade = fadeBetween(s.clip, clip, fadeMs);
      if (from && fade > 0) action.crossFadeFrom(from, fade / 1000, false);
      else if (from) from.stop();
      s.clip = clip;
      s.action = action;
      s.weight = weight;
      return action;
    };
    return {
      play(clip, options = {}) {
        const weight = options.intensity === undefined ? 1 : clipWeight(options.intensity);
        activate(clip, options.fadeMs ?? CROSSFADE_MS, options.loop ?? isLooping(clip), weight);
      },
      setLocomotion(gait, distance) {
        const action = s.clip === gait ? s.action : activate(gait, CROSSFADE_MS, true, 1);
        if (!action) return;
        const cycle = gait === 'walk' ? rig.extras.walk : rig.extras.run;
        action.time = clipTimeAtPhase(gait, phaseFromDistance(distance, cycle));
      },
      leap(ms, beats) {
        const action = s.clip === 'leap' ? s.action : activate('leap', CROSSFADE_MS, false, 1);
        if (!action) return;
        action.setEffectiveTimeScale(0);
        action.time = Math.min(leapClipTime(ms, beats), clipSeconds('leap'));
      },
      setFacing(yaw, snap = false) {
        s.targetYaw = yaw;
        if (snap) {
          s.yaw = yaw;
          if (outer.current) outer.current.rotation.y = yaw;
        }
        s.snap = snap || s.reduced;
      },
      setEmotion(next) {
        s.emotion = next;
      },
      setLit(on) {
        s.lit = on;
      },
      sample(clip, time) {
        const action = activate(clip, 0, isLooping(clip), 1);
        if (!action) return;
        action.setEffectiveTimeScale(0);
        action.paused = false;
        action.time = time;
        rig.mixer.update(0);
      },
      settle() {
        rig.mixer.update(0);
      },
      get clip() {
        return s.clip;
      },
      root: rig.root,
      stride: rig.extras,
    };
  }, [rig]);
  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    handle.play('idle', { fadeMs: 0 });
  }, [handle]);

  const ringGeometry = useMemo(() => new RingGeometry(RING_RADIUS - RING_WIDTH, RING_RADIUS, 48), []);
  const ringMaterial = useMemo(
    () =>
      new MeshBasicMaterial({ color: '#F39C2B', transparent: true, depthWrite: false, toneMapped: false }),
    [],
  );
  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [ringGeometry, ringMaterial],
  );

  useFrame((_, delta) => {
    const s = state.current;
    const dtMs = delta * 1000;
    s.yaw = easeYaw(s.yaw, s.targetYaw, dtMs, s.snap);
    if (outer.current) outer.current.rotation.y = s.yaw;
    // emotion clips played with intensity < 1 keep idle underneath
    const idle = rig.actions.get('idle');
    if (idle && s.action && s.action !== idle && s.weight < 1 && !isDistanceDriven(s.clip ?? 'idle')) {
      idle.enabled = true;
      idle.setEffectiveWeight(1 - s.weight);
      if (!idle.isRunning()) idle.play();
    }
    rig.mixer.update(delta);
    // face: emotion frame, blinking at idle
    const now = performance.now();
    if (blink && now >= s.blinkAt) {
      s.blinkUntil = now + BLINK_MS;
      s.blinkAt = now + nextBlinkInMs(Math.random());
    }
    showFrame(rig.face, faceFrameOf(s.emotion, now < s.blinkUntil));
    // ring
    const node = ring.current;
    if (node) {
      node.visible = s.lit;
      ringMaterial.opacity = s.reduced ? 0.8 : 0.7 + 0.3 * Math.sin((now / PULSE_MS) * Math.PI * 2);
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} renderOrder={1}>
        <planeGeometry args={[0.75, 0.75]} />
        <meshBasicMaterial map={blob()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh
        ref={ring}
        geometry={ringGeometry}
        material={ringMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.008, 0]}
        renderOrder={2}
        visible={lit}
      />
      <group ref={outer}>
        <primitive object={rig.root} />
      </group>
    </group>
  );
}

/**
 * Drive a Hero from the BoardView model each frame: position and clip from the token (see heroDirector.ts for the
 * BoardView call to clip mapping). The caller places the group; this sets facing, clips, emotion and the lit ring.
 */
export function useHeroActor(
  hero: { current: HeroHandle | null },
  view: DioramaView,
  player: number,
  options: {
    reducedMotion?: boolean;
    /** True while this player's token slides or arcs without steps (triple six, re-fan, entry). */
    glide?: (player: number) => boolean;
  } = {},
): void {
  const director = useMemo(() => new HeroDirector(), []);
  useFrame((_, delta) => {
    const handle = hero.current;
    const token = view.tokens[player];
    if (!handle || !token) return;
    const mood = view.moods[player];
    const winner = view.ranking?.[0] === player;
    const directive = director.update(delta * 1000, {
      spot: token.spot,
      scale: token.scale,
      onBridge: token.override !== null,
      // the board winner is excited; `cheer` (the somersault) only while the Win screen is up (R4)
      emotion: mood?.emotion ?? (winner ? 'excited' : null),
      reaction: mood?.reaction ?? null,
      glide: token.gliding || options.glide?.(player) === true || token.lift > ENTRY_ARC_LIFT,
      won: winner && view.winShown,
    });
    const reduced = options.reducedMotion === true;
    handle.setFacing(token.heading, reduced);
    if (token.leap && !reduced) {
      handle.leap(token.leap.ms, token.leap.beats);
    } else if (!reduced && (directive.clip === 'walk' || directive.clip === 'run')) {
      handle.setLocomotion(directive.clip, directive.distance / CELL);
    } else {
      // reduced motion: the token glides in the idle pose (T44 4.6), no steps
      const clip = directive.clip === 'walk' || directive.clip === 'run' ? 'idle' : directive.clip;
      const intensity = mood && clip !== 'idle' && clip !== 'cheer' ? mood.reaction.intensity : undefined;
      if (handle.clip !== clip) handle.play(clip, { intensity });
    }
    handle.setEmotion(directive.emotion);
    handle.setLit(view.current === player && token.override === null);
  });
}
