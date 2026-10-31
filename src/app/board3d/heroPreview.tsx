// Dev preview of the clay heroes: /hero.html?hero=hanuman&clip=idle&cam=three&lit=1
// Buttons play the clips; `window.__hero` is the headless hook (scripts/blender/hero-check.mjs): freeze a clip at a
// time, walk a straight line by distance, sample foot bones for the planted-foot drift, read fps and triangles.

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, type ComponentRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PCFSoftShadowMap,
  PMREMGenerator,
  Vector3,
  ACESFilmicToneMapping,
  type Group,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Hero, type HeroHandle, type HeroId } from './Hero';
import { HERO_CLIPS, type HeroClip } from './heroClips';

const params = new URLSearchParams(location.search);
const heroId = (params.get('hero') ?? 'hanuman') as HeroId;

const CAMERAS: Record<string, { az: number; el: number; dist: number; target: [number, number, number] }> = {
  front: { az: 0, el: 8, dist: 4.6, target: [0, 0.72, 0] },
  three: { az: 35, el: 14, dist: 4.4, target: [0, 0.72, 0] },
  side: { az: 90, el: 6, dist: 4.6, target: [0, 0.72, 0] },
  back: { az: 180, el: 12, dist: 4.6, target: [0, 0.72, 0] },
  iso: { az: 22, el: 38, dist: 5.2, target: [0, 0.6, 0] },
  face: { az: 12, el: 6, dist: 1.5, target: [0, 1.1, 0] },
  wide: { az: 40, el: 16, dist: 7.5, target: [0, 0.7, 0] },
};

interface PreviewApi {
  ready: boolean;
  clips: HeroClip[];
  setCamera(name: string | { az: number; el: number; dist: number; target?: [number, number, number] }): void;
  /** Freeze clip `clip` at `time` seconds, hero at the origin facing `yaw`. */
  pose(clip: HeroClip, time: number, yaw?: number): void;
  play(clip: HeroClip): void;
  /** Hero on a straight path at yaw `yaw`, `distance` board units from the origin, gait phase from the distance. */
  walkTo(gait: 'walk' | 'run', distance: number, yaw?: number): void;
  leapAt(ms: number, beats: [number, number, number, number]): void;
  setEmotion(emotion: 'idle' | 'happy' | 'excited' | 'scared' | 'sad'): void;
  setLit(lit: boolean): void;
  /** Lowest skinned point of each foot, world space (what touches the tile). */
  feet(): { L: number[]; R: number[]; soleY: number; ankleL: number[]; ankleR: number[] };
  stats(): {
    fps: number;
    triangles: number;
    bones: number;
    clips: string[];
    stride: { walk: number; run: number };
  };
}

const api = { ready: false, clips: HERO_CLIPS } as PreviewApi;
(window as unknown as { __hero: PreviewApi }).__hero = api;

let fps = 0;

function Room() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.3;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Scene() {
  const holder = useRef<Group>(null);
  const hero = useRef<HeroHandle>(null);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const frames = useRef({ n: 0, start: performance.now() });

  useFrame(() => {
    frames.current.n++;
    const now = performance.now();
    if (now - frames.current.start >= 1000) {
      fps = (frames.current.n * 1000) / (now - frames.current.start);
      frames.current = { n: 0, start: now };
      const hud = document.getElementById('hud');
      if (hud) hud.textContent = `${hero.current?.clip ?? '-'}  ${fps.toFixed(0)} fps`;
    }
  });

  useEffect(() => {
    const setCamera: PreviewApi['setCamera'] = (spec) => {
      const c = typeof spec === 'string' ? (CAMERAS[spec] ?? CAMERAS.three!) : spec;
      const target = (c as { target?: [number, number, number] }).target ?? [0, 0.72, 0];
      const az = (c.az * Math.PI) / 180;
      const el = (c.el * Math.PI) / 180;
      camera.position.set(
        target[0] + Math.sin(az) * Math.cos(el) * c.dist,
        target[1] + Math.sin(el) * c.dist,
        target[2] + Math.cos(az) * Math.cos(el) * c.dist,
      );
      controls.current?.target.set(...target);
      controls.current?.update();
    };
    setCamera(params.get('cam') ?? 'three');
    const place = (distance: number, yaw: number): void => {
      holder.current?.position.set(Math.sin(yaw) * distance, 0, Math.cos(yaw) * distance);
    };
    // The lowest skinned vertex of each foot (the point a viewer sees touching the tile), world space.
    let footVerts: { mesh: SkinnedMesh; left: number[]; right: number[] } | null = null;
    const footPositions = (): {
      L: number[];
      R: number[];
      soleY: number;
      ankleL: number[];
      ankleR: number[];
    } => {
      const out = { L: [0, 0, 0], R: [0, 0, 0], soleY: 0, ankleL: [0, 0, 0], ankleR: [0, 0, 0] };
      const root = hero.current?.root;
      if (!root) return out;
      if (!footVerts) {
        root.traverse((o: Object3D) => {
          const mesh = o as SkinnedMesh;
          if (!mesh.isSkinnedMesh || (mesh.material as { name?: string }).name === 'face') return;
          const position = mesh.geometry.attributes.position!;
          const left: number[] = [];
          const right: number[] = [];
          for (let i = 0; i < position.count; i++) {
            if (position.getY(i) < 0.045) (position.getX(i) > 0 ? left : right).push(i);
          }
          footVerts = { mesh, left, right };
        });
      }
      const fv = footVerts as { mesh: SkinnedMesh; left: number[]; right: number[] } | null;
      if (!fv) return out;
      holder.current?.updateMatrixWorld(true);
      const tmp = new Vector3();
      const lowest = (indices: number[]): number[] => {
        let best = [0, 1e9, 0];
        for (const i of indices) {
          fv.mesh.getVertexPosition(i, tmp);
          fv.mesh.localToWorld(tmp);
          if (tmp.y < best[1]!) best = tmp.toArray();
        }
        return best;
      };
      root.traverse((o: Object3D) => {
        if (o.name === 'footL') out.ankleL = o.getWorldPosition(tmp).toArray();
        if (o.name === 'footR') out.ankleR = o.getWorldPosition(tmp).toArray();
      });
      out.L = lowest(fv.left);
      out.R = lowest(fv.right);
      out.soleY = Math.min(out.L[1]!, out.R[1]!);
      return out;
    };
    Object.assign(api, {
      setCamera,
      pose(clip, time, yaw = 0.35) {
        place(0, 0);
        hero.current?.setFacing(yaw, true);
        hero.current?.sample(clip, time);
      },
      play(clip) {
        hero.current?.play(clip);
      },
      walkTo(gait, distance, yaw = 0) {
        place(distance, yaw);
        hero.current?.setFacing(yaw, true);
        if (hero.current?.clip !== gait) hero.current?.play(gait, { fadeMs: 0 }); // a test frame, not a blend
        hero.current?.setLocomotion(gait, distance);
        hero.current?.settle();
      },
      leapAt(ms, beats) {
        hero.current?.leap(ms, beats);
        hero.current?.settle();
      },
      setEmotion(e) {
        hero.current?.setEmotion(e);
      },
      setLit(lit) {
        hero.current?.setLit(lit);
      },
      feet: footPositions,
      stats() {
        let triangles = 0;
        let bones = 0;
        hero.current?.root.traverse((o: Object3D) => {
          const mesh = o as SkinnedMesh;
          if (!mesh.isMesh) return;
          const g = mesh.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position!.count) / 3;
          if (mesh.isSkinnedMesh) bones = Math.max(bones, mesh.skeleton.bones.length);
        });
        return {
          fps,
          triangles,
          bones,
          clips: HERO_CLIPS,
          stride: hero.current?.stride ?? { walk: 0, run: 0 },
        };
      },
    } satisfies Partial<PreviewApi>);
    const ui = document.getElementById('ui');
    if (ui) {
      ui.replaceChildren();
      for (const clip of HERO_CLIPS) {
        const b = document.createElement('button');
        b.textContent = clip;
        b.addEventListener('click', () => {
          place(0, 0);
          hero.current?.play(clip);
        });
        ui.append(b);
      }
    }
    const initial = params.get('clip') as HeroClip | null;
    const wait = setInterval(() => {
      if (!hero.current) return;
      clearInterval(wait);
      if (initial && HERO_CLIPS.includes(initial)) hero.current.play(initial, { fadeMs: 0 });
      api.ready = true;
    }, 30);
    return () => clearInterval(wait);
  }, [camera]);

  return (
    <>
      <Room />
      <hemisphereLight args={['#D8DDF5', '#8C96C8', 0.3]} />
      <directionalLight
        color="#FFF1E0"
        intensity={1.6}
        position={[8, 14, 6]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight color="#E6EBFF" intensity={0.5} position={[-9, 7, -7]} />
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[7, 0.32, 5]} />
        <meshStandardMaterial color="#A8CF86" roughness={0.92} />
      </mesh>
      <group ref={holder}>
        <Suspense fallback={null}>
          <Hero
            ref={hero}
            hero={heroId}
            lit={params.get('lit') === '1'}
            blink={params.get('blink') !== '0'}
          />
        </Suspense>
      </group>
      <OrbitControls ref={controls} makeDefault enableDamping={false} maxPolarAngle={1.3} />
    </>
  );
}

function Preview() {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{ position: [3, 1.5, 4], fov: 32, near: 0.05, far: 60 }}
      gl={{
        antialias: true,
        alpha: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        preserveDrawingBuffer: true,
      }}
    >
      <Scene />
    </Canvas>
  );
}

const container = document.getElementById('app');
if (container) createRoot(container).render(<Preview />);
