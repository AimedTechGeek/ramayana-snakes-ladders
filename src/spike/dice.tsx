// Dev-only preview of the 3D die on a plinth ledge (not part of the game build): `npx vite`, open /dice.html.
// window.__dice.roll(value, fast, turn) / window.__dice.taps are the hooks the headless check drives.
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PCFSoftShadowMap, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Die, type DieHandle } from '../app/board3d/Die';

declare global {
  interface Window {
    __dice?: { roll: DieHandle['roll']; taps: number; contacts: number };
  }
}

const params = new URLSearchParams(location.search);

function Studio() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }, [gl, scene]);
  return null;
}

function Preview() {
  const rollRef = useRef<DieHandle>(null);
  const state = useRef({ taps: 0, contacts: 0 });
  useEffect(() => {
    window.__dice = {
      roll: (v, fast, turn) => rollRef.current!.roll(v, fast, turn),
      get taps() {
        return state.current.taps;
      },
      get contacts() {
        return state.current.contacts;
      },
    };
  }, []);
  const close = params.get('cam') === 'close';
  const top = params.get('cam') === 'top';
  return (
    <Canvas
      dpr={[1, 2]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{
        position: top ? [0, 4.5, 0.01] : close ? [0.9, 2.2, 2.0] : [2.6, 3.6, 3.6],
        fov: 34,
        near: 0.1,
        far: 50,
      }}
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      gl={{ alpha: true, antialias: true }}
    >
      <Studio />
      <hemisphereLight args={['#D8DDF5', '#8C96C8', 0.7]} />
      <directionalLight
        color="#FFF1E0"
        intensity={2.4}
        position={[3, 5, 2.5]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight color="#E6EBFF" intensity={0.5} position={[-4, 3, -3]} />
      {/* the plinth ledge the tray sits on */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.16, 2.4]} />
        <meshStandardMaterial color="#C9A77E" roughness={0.9} />
      </mesh>
      <Die
        rollRef={rollRef}
        idle
        onTap={() => (state.current.taps += 1)}
        onContact={() => (state.current.contacts += 1)}
        reducedMotion={params.has('reduced')}
      />
    </Canvas>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);
