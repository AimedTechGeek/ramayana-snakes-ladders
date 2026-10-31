// Dev-only preview of the scenery (served by `vite` at /scripts/props-preview/): a contact sheet of every prop kind
// by region, the landmarks close up, or the whole board with every prop. Driven by the query string, read by
// scripts/props-preview/shots.mjs (window.__ready, window.__info). Not part of the game build.

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Board } from './Board';
import type { DioramaView } from './DioramaView';
import { PropsLayer } from './Props';
import { MANIFEST_KINDS } from './propLayout';
import { bodyMaterial, glowMaterial, kindGeometry, usePropsScene } from './scenery';

const params = new URLSearchParams(location.search);
const num = (key: string, fallback: number): number => Number(params.get(key) ?? fallback);
const mode = params.get('mode') ?? 'board';
const ALL = new Set(Array.from({ length: 144 }, (_, i) => i + 1));
const REGIONS = ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'] as const;
const TILE: Record<string, string> = {
  mithila: '#A8CF86',
  ayodhya: '#EAD3A3',
  dandaka: '#6B9A58',
  ganga: '#78BBD2',
  kishkindha: '#D9AB78',
  sea: '#6AAECB',
  lanka: '#4D528F',
};

function Rig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const target = new Vector3(num('tx', 0), num('ty', 0), num('tz', 0));
    const az = num('az', 0),
      polar = num('polar', 0.8),
      dist = num('dist', 10);
    camera.position.set(
      target.x + dist * Math.sin(polar) * Math.sin(az),
      target.y + dist * Math.cos(polar),
      target.z + dist * Math.sin(polar) * Math.cos(az),
    );
    camera.lookAt(target);
    const pmrem = new PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    let frames = 0;
    const tick = (): void => {
      frames++;
      if (frames === 20) {
        (window as unknown as { __ready: boolean }).__ready = true;
        (window as unknown as { __dbg: unknown }).__dbg = () => scene.children.length;
        (window as unknown as { __info: unknown }).__info = () => ({
          ...gl.info.render,
          geometries: gl.info.memory.geometries,
        });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [camera, gl, scene]);
  return null;
}

function Sheet() {
  const scene = usePropsScene();
  const tile = useMemo(() => new RoundedBoxGeometry(1.5, 0.12, 1.5, 2, 0.04), []);
  const rows = REGIONS.map((region) => ({
    region,
    kinds: Object.values(MANIFEST_KINDS).filter(
      (k) => !k.fly && !k.landmark && k.glb === 'props' && k.regions[0] === region,
    ),
  }));
  const only = params.get('region');
  const scale = num('scale', 2.4);
  return (
    <group>
      {rows
        .filter((r) => !only || r.region === only)
        .map((row, ri) =>
          row.kinds.map((kind, ki) => {
            const g = kindGeometry(scene, kind.kind);
            return (
              <group key={kind.kind} position={[ki * 1.6 - 7, 0, ri * 1.8 - 5]}>
                <mesh geometry={tile} position={[0, -0.06, 0]}>
                  <meshStandardMaterial color={TILE[row.region]} roughness={0.85} />
                </mesh>
                <group scale={scale} rotation={[0, num('spin', 0), 0]}>
                  {g.body && <mesh geometry={g.body} material={bodyMaterial(kind.anim)} castShadow />}
                  {g.glow && <mesh geometry={g.glow} material={glowMaterial(kind.kind)} />}
                </group>
              </group>
            );
          }),
        )}
    </group>
  );
}

function FullBoard() {
  const view = useMemo(() => ({ revealedTerrain: ALL, setup: null }) as unknown as DioramaView, []);
  return (
    <group>
      <Board view={view} onTap={() => undefined} />
      <Suspense fallback={null}>
        <PropsLayer revealed={ALL} />
      </Suspense>
    </group>
  );
}

function App() {
  return (
    <Canvas
      dpr={num('dpr', 2)}
      camera={{ position: [0, 10, 10], fov: num('fov', 40), near: 0.05, far: 100 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <color attach="background" args={['#8C96C8']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 10, 6]} intensity={1.0} />
      <Rig />
      <Suspense fallback={null}>{mode === 'sheet' ? <Sheet /> : <FullBoard />}</Suspense>
    </Canvas>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
