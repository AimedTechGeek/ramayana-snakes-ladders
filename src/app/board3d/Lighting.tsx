// The studio lighting rig and page background of the diorama (T44 spec 1.3): RoomEnvironment for fill and reflections,
// a warm shadow-casting key, a hemisphere fill, a cool rim, and the periwinkle gradient the canvas sits on.

import { ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLINTH_BOTTOM_Y } from './boardLayout';
import { isPhoneWidth } from './cameraConfig';

/** Page gradient plus the soft light pool under the board (spec 1.1); canvas is transparent over it. */
export const BACKDROP =
  'radial-gradient(ellipse 60% 40% at 55% 62%, rgba(214,220,255,.35), transparent 70%),' +
  'linear-gradient(165deg, #9AA3D9 0%, #8C96C8 55%, #7E88BC 100%)';

const ENV_INTENSITY = 0.32;

export function Lighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const width = useThree((state) => state.size.width);
  const shadowMap = isPhoneWidth(width) ? 1024 : 2048;

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <hemisphereLight args={['#D8DDF5', '#8C96C8', 0.25]} />
      <directionalLight
        color="#FFF1E0"
        intensity={1.7}
        position={[8, 14, 6]}
        castShadow
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-camera-left={-8.5}
        shadow-camera-right={8.5}
        shadow-camera-top={8.5}
        shadow-camera-bottom={-8.5}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
      />
      <directionalLight color="#E6EBFF" intensity={0.5} position={[-9, 7, -7]} />
    </>
  );
}

/** The static soft pool under the plinth (a still contact shadow, like Chimakes). Mount inside the board's Suspense. */
export function PlinthShadow() {
  return (
    <ContactShadows
      position={[0, PLINTH_BOTTOM_Y + 0.005, 0]}
      scale={18}
      resolution={512}
      far={1.5}
      blur={2.5}
      opacity={0.5}
      frames={1}
    />
  );
}
