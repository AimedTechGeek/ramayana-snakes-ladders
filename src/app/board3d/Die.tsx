// The 3D die and its teak tray (public/models/dice/die.glb). Self-contained: mount it at the tray anchor and call
// `rollRef.current.roll(value, fast)`; it plays one of the three baked tumble clips, corrects the end orientation so
// `value` faces up (dieRoll.ts) and resolves when the die has settled. A tap on the tray (not a drag) calls `onTap`.

import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import {
  AdditiveBlending,
  AnimationMixer,
  DoubleSide,
  LoopOnce,
  Mesh,
  Quaternion,
  type AnimationAction,
  type Material,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import {
  CLIP_FPS,
  CONTACT_FRAMES,
  DIE_HALF_EDGE,
  FAST_FACTOR,
  clipIndex,
  correctedOrientation,
  finalOrientation,
  isTap,
  restHeight,
  type DieValue,
  type PointerSample,
} from './dieRoll';

const MODEL_URL = `${import.meta.env.BASE_URL}models/dice/die.glb`;
const BOB_AMPLITUDE = 0.01;
const BOB_SECONDS = 1.2;
const FADE_SECONDS = 0.12;
const SIX_PULSE_SECONDS = 0.9;

export interface DieHandle {
  /** Tumble and land with `value` face up; resolves when settled. `turn` picks the clip as (value + turn) mod 3. */
  roll(value: number, fast: boolean, turn?: number): Promise<void>;
}

export interface DieProps {
  /** The tray anchor: the middle of the felt floor. */
  position?: [number, number, number];
  rotationY?: number;
  /** A tap (not a drag) on the tray or die. */
  onTap?: () => void;
  rollRef?: RefObject<DieHandle | null>;
  /** The die touches the tray (clip frames 6, 12, 18): play the clatter tick here. */
  onContact?: () => void;
  /** A human may roll: the die bobs and the saffron ring under the tray pulses. */
  idle?: boolean;
  /** Snap to the result with a 120 ms fade instead of tumbling. */
  reducedMotion?: boolean;
}

interface ActiveRoll {
  value: DieValue;
  clipEnd: Quaternion;
  /** null when reduced motion snapped the die to its result. */
  action: AnimationAction | null;
  lastFrame: number;
  /** The clip has finished and the correction is baked into the die's pose. */
  settled: boolean;
}

function isDieValue(value: number): value is DieValue {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function DieModel({
  position = [0, 0, 0],
  rotationY = 0,
  onTap,
  rollRef,
  onContact,
  idle,
  reducedMotion,
}: DieProps) {
  const gltf = useGLTF(MODEL_URL);
  const scene = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.material = (node.material as Material).clone();
      node.castShadow = node.parent?.name === 'die' || node.name === 'die';
      node.receiveShadow = true;
    });
    return root;
  }, [gltf]);
  const die = useMemo(() => {
    // rest pose: centred on the felt, face 1 up (the glTF node keeps the last baked frame)
    const node = scene.getObjectByName('die') as Object3D;
    node.position.set(0, DIE_HALF_EDGE, 0);
    node.quaternion.identity();
    return node;
  }, [scene]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const baseY = useMemo(() => die.position.y, [die]);
  const active = useRef<ActiveRoll | null>(null);
  const settle = useRef<(() => void) | null>(null);
  const turns = useRef(0);
  const down = useRef<PointerSample | null>(null);
  const fade = useRef(0);
  const sixPulse = useRef(0);
  const ring = useRef<Mesh>(null);
  const callbacks = useRef({ onTap, onContact });
  useEffect(() => {
    callbacks.current = { onTap, onContact };
  });

  const finish = useCallback(() => {
    const done = settle.current;
    settle.current = null;
    done?.();
  }, []);

  useEffect(() => {
    const onFinished = (): void => finish();
    mixer.addEventListener('finished', onFinished);
    return () => {
      mixer.removeEventListener('finished', onFinished);
      mixer.stopAllAction();
      finish();
    };
  }, [mixer, finish]);

  useImperativeHandle(
    rollRef,
    () => ({
      roll(value, fast, turn) {
        if (!isDieValue(value)) return Promise.reject(new Error(`die value ${value} is not 1-6`));
        finish();
        mixer.stopAllAction();
        const index = clipIndex(value, turn ?? turns.current++);
        const clip = gltf.animations.find((a) => a.name === `tumble_${index}`);
        const rotation = clip?.tracks.find((t) => t.name === 'die.quaternion');
        const travel = clip?.tracks.find((t) => t.name === 'die.position');
        if (!clip || !rotation || !travel)
          return Promise.reject(new Error(`die.glb has no clip tumble_${index}`));
        const q = rotation.values;
        const clipEnd = new Quaternion(
          q[q.length - 4],
          q[q.length - 3],
          q[q.length - 2],
          q[q.length - 1],
        ).normalize();
        const roll: ActiveRoll = { value, clipEnd, action: null, lastFrame: 0, settled: true };
        active.current = roll;
        sixPulse.current = 0;
        if (reducedMotion) {
          const rest = finalOrientation(clipEnd, value);
          const p = travel.values;
          die.quaternion.copy(rest);
          die.position.set(p[p.length - 3] ?? 0, restHeight(rest), p[p.length - 1] ?? 0);
          fade.current = FADE_SECONDS;
        } else {
          const action = mixer.clipAction(clip);
          action.reset();
          action.setLoop(LoopOnce, 1);
          action.clampWhenFinished = true;
          action.timeScale = fast ? FAST_FACTOR : 1;
          action.play();
          roll.action = action;
          roll.settled = false;
        }
        return new Promise<void>((resolve) => {
          settle.current = () => {
            if (value === 6) sixPulse.current = SIX_PULSE_SECONDS;
            resolve();
          };
          if (reducedMotion) setTimeout(() => finish(), FADE_SECONDS * 1000);
        });
      },
    }),
    [die, gltf, mixer, reducedMotion, finish],
  );

  useFrame((state, delta) => {
    const roll = active.current;
    const clock = state.clock.elapsedTime;
    const bob = idle && !reducedMotion ? Math.sin((clock / BOB_SECONDS) * Math.PI * 2) * BOB_AMPLITUDE : 0;
    if (!roll) {
      die.position.y = baseY + bob;
    } else if (roll.action && !roll.settled) {
      mixer.update(delta);
      const frame = roll.action.time * CLIP_FPS;
      for (const contact of CONTACT_FRAMES) {
        if (roll.lastFrame < contact && frame >= contact) callbacks.current.onContact?.();
      }
      roll.lastFrame = frame;
      // the mixer has just written the clip's pose (a paused action no longer writes: its pose is the clip end)
      const pose = roll.action.paused ? roll.clipEnd : die.quaternion;
      const corrected = correctedOrientation(pose, roll.clipEnd, roll.value, frame);
      die.quaternion.copy(corrected);
      die.position.y = Math.max(die.position.y, restHeight(corrected));
      // a finished clamped action stops writing, so the corrected pose is final from the next frame on
      if (roll.action.paused) roll.settled = true;
    } else {
      die.position.y = restHeight(die.quaternion) + bob;
    }

    if (fade.current > 0) fade.current = Math.max(0, fade.current - delta);
    const opacity = reducedMotion && roll ? 1 - fade.current / FADE_SECONDS : 1;
    die.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const material = node.material as MeshStandardMaterial;
      material.transparent = opacity < 1;
      material.opacity = opacity;
    });

    const ringNode = ring.current;
    if (!ringNode) return;
    const material = ringNode.material as MeshBasicMaterial;
    sixPulse.current = Math.max(0, sixPulse.current - delta);
    if (sixPulse.current > 0) {
      const k = 1 - sixPulse.current / SIX_PULSE_SECONDS;
      material.color.set('#E9C12F');
      material.opacity = 0.7 * (1 - k);
      ringNode.scale.setScalar(1 + k * 0.35);
      ringNode.visible = true;
    } else if (idle) {
      const pulse = 0.5 + 0.5 * Math.sin((clock / BOB_SECONDS) * Math.PI * 2);
      material.color.set('#F39C2B');
      material.opacity = 0.25 + 0.3 * pulse;
      ringNode.scale.setScalar(1 + 0.04 * pulse);
      ringNode.visible = true;
    } else {
      ringNode.visible = false;
    }
  });

  const onPointerDown = (e: ThreeEvent<PointerEvent>): void => {
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>): void => {
    const start = down.current;
    down.current = null;
    if (!start) return;
    const up = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, t: performance.now() };
    if (!isTap(start, up)) return;
    e.stopPropagation();
    callbacks.current.onTap?.();
  };

  return (
    <group position={position} rotation-y={rotationY}>
      <primitive object={scene} />
      <mesh ref={ring} position={[0, -0.125, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.92, 1.02, 48]} />
        <meshBasicMaterial
          transparent
          opacity={0.4}
          side={DoubleSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <boxGeometry args={[1.8, 0.6, 1.4]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}

export function Die(props: DieProps) {
  return (
    <Suspense fallback={null}>
      <DieModel {...props} />
    </Suspense>
  );
}
