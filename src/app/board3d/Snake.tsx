// The coiled clay snakes (T44 5): one skinned GLB per story id, lazy-loaded when the snake is first revealed (preloaded
// in idle time), standing inside its head block and nowhere else. Clips are baked at 24 fps and played stretched over the
// beat the DioramaView gives them (snakeChoreo.ts); the view's `snakeAct` says which beat is running.
//
//   <Snakes view={view} reducedMotion />            on the board: one <SnakePiece> per revealed snake
//   <SnakeFigure id="tataka" ref={handle} />        stand-alone (the preview page, tests)

import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, useSyncExternalStore, type Ref } from 'react';
import { AnimationAction, AnimationMixer, Group, LoopOnce, LoopRepeat, Mesh, Object3D, type Material } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Jump } from '../../core/types';
import type { DioramaView } from './DioramaView';
import { SNAKE_SCALE } from './figureScale';
import {
  SNAKE_META,
  clipSeconds,
  snakeAnchor,
  swayAt,
  tongueScale,
  type SnakeClip,
} from './snakeChoreo';

const url = (id: string): string => `${import.meta.env.BASE_URL}models/snakes/${id}.glb`;
export const preloadSnake = (id: string): void => useGLTF.preload(url(id), false, true);

/** Idle sway period (72 frames at 24 fps) in seconds. */
const IDLE_S = 3;

export interface SnakeHandle {
  readonly root: Object3D;
  /** Freeze the rig at progress u (0..1) of a clip. */
  sample(clip: SnakeClip, u: number): void;
  /** Idle at `seconds` (loops). */
  idleAt(seconds: number): void;
  /** Tongue scale 0..1 (applied after the clip each frame). */
  setTongue(scale: number): void;
  readonly bones: Record<string, Object3D>;
}

interface FigureProps {
  id: string;
  ref?: Ref<SnakeHandle>;
}

/** The GLB, cloned and with its materials made ready; no placement, no motion of its own (see SnakePiece). */
export function SnakeFigure({ id, ref }: FigureProps) {
  const gltf = useGLTF(url(id), false, true);
  const rig = useMemo(() => {
    const root = clone(gltf.scene) as Group;
    const mixer = new AnimationMixer(root);
    const actions = new Map<SnakeClip, AnimationAction>();
    for (const clip of gltf.animations) actions.set(clip.name as SnakeClip, mixer.clipAction(clip));
    const bones: Record<string, Object3D> = {};
    root.traverse((o) => {
      if (o.name === 'tongue' || o.name === 'bulge') bones[o.name] = o;
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false; // budget: the shadow pass is already near 44 of 50 (the coil's baked AO grounds it)
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned bounds are the bind pose; the strike leaves it
      (mesh.material as Material).name = 'clay';
    });
    // both are hidden by scale until a clip or a flick shows them (the mixer saves this as the original state)
    for (const bone of Object.values(bones)) bone.scale.setScalar(0.0001);
    return { root, mixer, actions, bones };
  }, [gltf]);
  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
    },
    [rig],
  );

  const state = useRef({ tongue: 0 });
  const handle = useMemo<SnakeHandle>(() => {
    const show = (clip: SnakeClip, seconds: number): void => {
      for (const [name, action] of rig.actions) {
        if (name !== clip) action.enabled = false;
      }
      const action = rig.actions.get(clip);
      if (!action) return;
      action.enabled = true;
      action.setLoop(clip === 'idle' ? LoopRepeat : LoopOnce, clip === 'idle' ? Infinity : 1);
      action.clampWhenFinished = true;
      action.setEffectiveTimeScale(0);
      action.setEffectiveWeight(1);
      if (!action.isRunning()) action.play();
      action.paused = false;
      action.time = seconds;
      rig.mixer.update(0);
      applyTongue();
    };
    const applyTongue = (): void => {
      const tongue = rig.bones.tongue;
      if (tongue) tongue.scale.setScalar(Math.max(0.0001, state.current.tongue));
    };
    const meta = SNAKE_META[id];
    return {
      root: rig.root,
      bones: rig.bones,
      sample(clip, u) {
        if (meta) show(clip, clipSeconds(meta, clip, u));
      },
      idleAt(seconds) {
        show('idle', ((seconds % IDLE_S) + IDLE_S) % IDLE_S);
      },
      setTongue(scale) {
        state.current.tongue = scale;
        applyTongue();
      },
    };
  }, [rig, id]);
  useImperativeHandle(ref, () => handle, [handle]);
  useEffect(() => {
    handle.idleAt(0);
  }, [handle]);
  return <primitive object={rig.root} />;
}

/** One revealed snake on the board: placed at its head block, driven by the view's beat and the clock. */
function SnakePiece({ view, jump, reducedMotion }: { view: DioramaView; jump: Jump & { id: string }; reducedMotion: boolean }) {
  const outer = useRef<Group>(null);
  /**
   * The close-up bite's growth (T45.4): a multiplier on top of whatever scale the root `outer` carries, about the coil
   * centre on the block top, so the coil swells up and out over the hero. Owner exception to respect rule R9
   * (2026-11-03): only while it bites, the grown head may rise above the hero; `view.snakeGrow` is empty at every
   * other moment (never in Fast, never under reduced motion), so R9 holds everywhere else.
   */
  const grown = useRef<Group>(null);
  const handle = useRef<SnakeHandle>(null);
  const anchor = useMemo(() => snakeAnchor(jump.from, jump.id), [jump.from, jump.id]);
  const flick = useRef({ next: performance.now() + 1500 + Math.random() * 3000, start: -1e9, lastAct: '' });
  useEffect(() => {
    view.snakeLoaded.add(jump.from);
    return () => {
      view.snakeLoaded.delete(jump.from);
    };
  }, [view, jump.from]);

  useFrame(() => {
    const node = outer.current;
    const snake = handle.current;
    if (!node || !snake) return;
    const now = performance.now();
    node.visible = !view.snakePending.has(jump.from);
    if (!node.visible) return;
    const f = flick.current;
    const act = view.snakeAct.get(jump.from);
    const scale = grown.current;
    if (scale) {
      const grow = view.snakeGrow.get(jump.from);
      scale.scale.setScalar(grow ?? 1);
      // the satisfied sway as the grown coil shrinks back (settle beat of a close-up bite)
      scale.rotation.z =
        grow !== undefined && act?.clip === 'settle' && act.ms > 0 ? swayAt((now - act.start) / act.ms) : 0;
    }
    if (act) {
      snake.sample(act.clip, act.ms <= 0 ? 1 : (now - act.start) / act.ms);
      if (act.clip === 'hold' && f.lastAct !== 'hold') f.start = now; // one flick as the head turns to the token
      f.lastAct = act.clip;
    } else {
      f.lastAct = '';
      snake.idleAt(reducedMotion ? 0 : now / 1000 + jump.from * 0.37);
      if (!reducedMotion && now >= f.next) {
        f.start = now;
        f.next = now + 3000 + Math.random() * 3000;
      }
    }
    snake.setTongue(reducedMotion ? 0 : tongueScale(now - f.start));
  });

  return (
    <group ref={outer} position={anchor} scale={SNAKE_SCALE} visible={false}>
      <group ref={grown}>
        <SnakeFigure id={jump.id} ref={handle} />
      </group>
    </group>
  );
}

/** Every revealed snake of the board; a snake's GLB is not requested until its reveal (and preloaded when idle). */
export function Snakes({ view, reducedMotion }: { view: DioramaView; reducedMotion: boolean }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const board = view.setup?.board;
  useEffect(() => {
    if (!board) return;
    const ids = board.snakes.map((snake) => snake.id);
    const run = (): void => ids.forEach(preloadSnake);
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const handle = idle ? idle(run) : window.setTimeout(run, 2000);
    return () => {
      if (!idle) window.clearTimeout(handle);
    };
  }, [board]);
  if (!board) return null;
  return (
    <group>
      {board.snakes
        .filter((jump) => view.jumpRise.has(jump.from))
        .map((jump) => (
          <SnakeSuspense key={jump.from} view={view} jump={jump} reducedMotion={reducedMotion} />
        ))}
    </group>
  );
}

function SnakeSuspense(props: { view: DioramaView; jump: Jump & { id: string }; reducedMotion: boolean }) {
  return (
    <Suspense fallback={null}>
      <SnakePiece {...props} />
    </Suspense>
  );
}
