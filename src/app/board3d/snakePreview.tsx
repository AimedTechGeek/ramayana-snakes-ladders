// Dev preview of the clay snakes: /snake.html?id=tataka. `window.__snake` is the headless hook the turntable and review
// scripts drive (scripts/blender/snake-check.mjs): pick a snake, freeze a clip at progress u, orbit the camera, read the
// decoded mesh back (triangles, bones, draw calls).

import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState, type ComponentRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ACESFilmicToneMapping, PCFSoftShadowMap, PMREMGenerator, type Mesh } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SnakeFigure, type SnakeHandle } from './Snake';
import { SNAKE_META, type SnakeClip } from './snakeChoreo';

const params = new URLSearchParams(location.search);

interface Cam {
  az: number;
  el: number;
  dist: number;
  target?: [number, number, number];
}

interface PreviewApi {
  ready: boolean;
  ids: string[];
  setSnake(id: string): void;
  setCamera(cam: Cam): void;
  pose(clip: SnakeClip, u: number): void;
  tongue(scale: number): void;
  stats(): { triangles: number; bones: number; drawCalls: number };
}
const api = { ready: false, ids: Object.keys(SNAKE_META) } as PreviewApi;
(window as unknown as { __snake: PreviewApi }).__snake = api;

function Room() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Scene() {
  const [id, setId] = useState(params.get('id') ?? 'tataka');
  const handle = useRef<SnakeHandle>(null);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const setCamera = (c: Cam): void => {
      const target = c.target ?? [0, 0.3, -0.05];
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
    setCamera({ az: 0, el: 28, dist: 3.1 });
    Object.assign(api, {
      setSnake: setId,
      setCamera,
      pose(clip: SnakeClip, u: number) {
        handle.current?.sample(clip, u);
      },
      tongue(scale: number) {
        handle.current?.setTongue(scale);
      },
      stats() {
        let triangles = 0;
        let bones = 0;
        handle.current?.root.traverse((o) => {
          const m = o as Mesh & { isSkinnedMesh?: boolean; skeleton?: { bones: unknown[] } };
          if (!m.isMesh) return;
          const g = m.geometry;
          triangles += (g.index ? g.index.count : g.attributes.position!.count) / 3;
          if (m.isSkinnedMesh && m.skeleton) bones = Math.max(bones, m.skeleton.bones.length);
        });
        return { triangles, bones, drawCalls: gl.info.render.calls };
      },
    } satisfies Partial<PreviewApi>);
    const wait = setInterval(() => {
      if (!handle.current) return;
      clearInterval(wait);
      api.ready = true;
    }, 30);
    return () => clearInterval(wait);
  }, [camera, gl]);

  return (
    <>
      <Room />
      <hemisphereLight args={['#D8DDF5', '#8C96C8', 0.7]} />
      <directionalLight
        color="#FFF1E0"
        intensity={2.4}
        position={[8, 14, 6]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <directionalLight color="#E6EBFF" intensity={0.5} position={[-9, 7, -7]} />
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[1, 0.16, 1]} />
        <meshStandardMaterial color="#6B9A58" roughness={0.92} />
      </mesh>
      {/* the head block's neighbours, so the cell edge reads */}
      <Suspense fallback={null}>
        <group position={[0, 0, -0.25]} key={id}>
          <SnakeFigure id={id} ref={handle} />
        </group>
      </Suspense>
      <OrbitControls ref={controls} makeDefault enableDamping={false} />
    </>
  );
}

const container = document.getElementById('app');
if (container) {
  createRoot(container).render(
    <Canvas
      dpr={[1, 2]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{ position: [0, 2, 3], fov: 32, near: 0.05, far: 60 }}
      gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping, preserveDrawingBuffer: true }}
    >
      <Scene />
    </Canvas>,
  );
}
