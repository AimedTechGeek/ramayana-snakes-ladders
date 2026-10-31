// The studio lighting rig and page background of the diorama (T44 spec 1.3): RoomEnvironment for fill and reflections,
// a warm shadow-casting key, a hemisphere fill, a cool rim, and the periwinkle gradient the canvas sits on.

import { ContactShadows } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLINTH_BOTTOM_Y } from './boardLayout';
import { isPhoneWidth } from './cameraConfig';

// The page gradient behind the transparent canvas is CSS (app.css `--page-bg`): the one background owner.

/**
 * Tuned at the T44.8 look checkpoint so the board and Hanuman both read: the key comes from the front-left (the
 * spec's front-right key sat beside the default camera and lit everything flat), so block sides and props show their
 * shading and cast soft shadows to the back-right; a lilac sky fill keeps the shadows pastel, not grey.
 */
/** Cube face size of the prefiltered RoomEnvironment (PMREM). */
const ENV_CUBE_SIZE = 64;
const ENV_INTENSITY = 0.12;
/** ACES exposure: a little under 1 keeps the pastel region colours from bleaching under the stronger key. */
const EXPOSURE = 0.85;
export const KEY = { color: '#FFF1E0', intensity: 3.0, position: [-7, 13, 6] as const };
export const FILL = { sky: '#DCE0FA', ground: '#9A8FB8', intensity: 0.6 };
export const RIM = { color: '#E6EBFF', intensity: 0.6, position: [8, 6, -8] as const };

export function Lighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const width = useThree((state) => state.size.width);
  const shadowMap = isPhoneWidth(width) ? 1024 : 2048;

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    // a 64 px cube is plenty for a 0.12 fill (T44.14): the default 256 made a 768 x 1024 half-float map, 6 MB of GPU
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: ENV_CUBE_SIZE }).texture;
    scene.environment = environment;
    scene.environmentIntensity = ENV_INTENSITY;
    gl.toneMappingExposure = EXPOSURE;
    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <hemisphereLight args={[FILL.sky, FILL.ground, FILL.intensity]} />
      <directionalLight
        color={KEY.color}
        intensity={KEY.intensity}
        position={[...KEY.position]}
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
      <directionalLight color={RIM.color} intensity={RIM.intensity} position={[...RIM.position]} />
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
