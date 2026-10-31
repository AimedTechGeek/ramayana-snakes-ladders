// The 3D diorama: blocks, numbers, jumps, tokens, soft room lighting and contact shadows, with a user-driven
// camera (damped orbit, clamped so it never goes under the board, no automatic follow).

import { CameraControls, ContactShadows } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, PMREMGenerator, Sphere, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SIZE } from '../../game/iso/world';
import { Blocks } from './Blocks';
import { UNIT } from './coords';
import type { DioramaView } from './DioramaView';
import { Jumps, Puffs, Tokens } from './Pieces';

const HALF_BOARD = (SIZE * UNIT) / 2;
/** Fitting this sphere keeps the whole board and the waiting tokens in view at any aspect. */
const BOARD_SPHERE = new Sphere(new Vector3(-0.3, 0, 0.4), HALF_BOARD + 0.9);
/** The camera target may wander this far past the board edge, no further. */
const PAN_BOX = new Box3(
  new Vector3(-HALF_BOARD - 0.5, -0.5, -HALF_BOARD - 0.5),
  new Vector3(HALF_BOARD + 0.5, 1.5, HALF_BOARD + 0.5),
);
const FIT_POLAR = 0.8;
const FOCUS_DISTANCE = 6;

/** Soft studio light from three's RoomEnvironment (generated, no files to fetch). */
function RoomLight() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.6;
    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function fitBoard(rig: CameraControls, animate: boolean): void {
  void rig.rotateTo(0, FIT_POLAR, animate);
  void rig.fitToSphere(BOARD_SPHERE, animate);
}

function CameraRig({ view }: { view: DioramaView }) {
  const controls = useRef<CameraControls>(null);
  /** The user has orbited, panned or zoomed since the last fit: a resize then keeps their view. */
  const moved = useRef(false);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  useEffect(() => {
    const rig = controls.current;
    if (!rig) return;
    rig.setBoundary(PAN_BOX);
    const onControl = (): void => {
      moved.current = true;
    };
    rig.addEventListener('controlstart', onControl);
    view.camera = {
      fit: () => {
        moved.current = false;
        fitBoard(rig, true);
      },
      focus: (player) => {
        const at = view.tokenPosition(player);
        if (!at) return;
        moved.current = true;
        void rig.moveTo(at[0], at[1], at[2], true);
        void rig.dollyTo(FOCUS_DISTANCE, true);
      },
    };
    return () => {
      rig.removeEventListener('controlstart', onControl);
      view.camera = null;
    };
  }, [view]);
  // The canvas size is part of the fit: until the user moves the camera, a resize or rotation re-fits the board.
  useEffect(() => {
    const rig = controls.current;
    if (rig && !moved.current) fitBoard(rig, false);
  }, [width, height]);
  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.25}
      draggingSmoothTime={0.08}
      minPolarAngle={0.15}
      maxPolarAngle={1.22}
      minDistance={3.5}
      maxDistance={26}
      dollyToCursor={false}
    />
  );
}

interface BoardCanvasProps {
  view: DioramaView;
  onBoardTap: () => void;
}

export function BoardCanvas({ view, onBoardTap }: BoardCanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 10, 10], fov: 40, near: 0.1, far: 100 }}
      data-testid="board-canvas"
    >
      <color attach="background" args={['#1b1a3a']} />
      <RoomLight />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 10, 6]} intensity={0.9} />
      <Blocks view={view} onTap={onBoardTap} />
      <Jumps view={view} />
      <Tokens view={view} />
      <Puffs view={view} />
      <ContactShadows
        position={[0, 0.003, 0]}
        scale={SIZE * UNIT + 1}
        resolution={512}
        far={1.6}
        blur={1.6}
        opacity={0.45}
      />
      <CameraRig view={view} />
    </Canvas>
  );
}
