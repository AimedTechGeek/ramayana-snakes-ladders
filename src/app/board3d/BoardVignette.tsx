// The title screen's hero object (T44 8.6 Boot): the real diorama, every block revealed, turning slowly at 2 deg/s
// (still under reduced motion). No tokens, die or controls: nothing is tapped here. It loads the same GLBs the game
// uses, so they are cached by the time Play is pressed.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { PCFSoftShadowMap, type Group, type PerspectiveCamera } from 'three';
import { boardFor } from '../../core/boards';
import { Board } from './Board';
import { SQUARES, blockTopY } from './boardLayout';
import { FIT_AZIMUTH, fitPose, fovFor } from './cameraConfig';
import { DioramaView } from './DioramaView';
import { Lighting, PlinthShadow } from './Lighting';
import { PropsLayer } from './Props';
import { useReducedMotion } from './scenery';

const TURN_RADIANS_PER_S = (2 * Math.PI) / 180;

function vignetteView(): DioramaView {
  const view = new DioramaView();
  view.init({
    board: boardFor('easy'),
    state: {
      level: 'easy',
      playOn: false,
      players: [],
      current: 0,
      sixesThisTurn: 0,
      turnStartPosition: 0,
      over: false,
    },
    reveal: { terrain: Array.from({ length: SQUARES }, (_, i) => i + 1), jumps: [] },
  });
  return view;
}

/** Fit pose for this canvas, set once per size (the board turns, the camera stays). */
function FixedCamera() {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  useLayoutEffect(() => {
    camera.fov = fovFor(width);
    const { position, target } = fitPose(width, height, FIT_AZIMUTH);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

function Turntable({ view, still }: { view: DioramaView; still: boolean }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!still && group.current) group.current.rotation.y += delta * TURN_RADIANS_PER_S;
  });
  return (
    <group ref={group}>
      <Suspense fallback={null}>
        <Board view={view}>
          <PropsLayer revealed={view.revealedTerrain} blockTopY={blockTopY} />
        </Board>
        <PlinthShadow />
      </Suspense>
    </group>
  );
}

export function BoardVignette() {
  const view = useMemo(vignetteView, []);
  const still = useReducedMotion();
  return (
    <Canvas
      className="board-vignette"
      dpr={[1, 1.5]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{ fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      data-testid="boot-board"
    >
      <Lighting />
      <FixedCamera />
      <Turntable view={view} still={still} />
    </Canvas>
  );
}
