// The 3D diorama canvas: periwinkle backdrop, studio lighting, the board (plinth, soil slab, blocks, fog, chips),
// the pieces, and a player-driven camera (no automatic follow).
// Mount points for the other T44 parts, all in board coordinates (boardLayout.ts):
//   - props and landmarks (T44.4): children of <Board>, seeded per square, standing at blockTopY(square)
//   - the die and its tray (T44.7): at TRAY_ANCHOR on the oak ledge

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { PCFSoftShadowMap } from 'three';
import { Board } from './Board';
import { CameraRig } from './Camera';
import { isPhoneWidth } from './cameraConfig';
import type { DioramaView } from './DioramaView';
import { BACKDROP, Lighting, PlinthShadow } from './Lighting';
import { Jumps, Puffs, Tokens } from './Pieces';

interface BoardCanvasProps {
  view: DioramaView;
  onBoardTap: () => void;
}

/** DPR cap: 2 on desktop and tablet, 1.5 for phone-width canvases (spec 1.3). */
function dprCap(): number {
  return isPhoneWidth(window.innerWidth) ? 1.5 : 2;
}

export function BoardCanvas({ view, onBoardTap }: BoardCanvasProps) {
  return (
    <Canvas
      dpr={[1, dprCap()]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{ position: [0, 12, 14], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: BACKDROP }}
      data-testid="board-canvas"
    >
      <Lighting />
      <Suspense fallback={null}>
        <Board view={view} onTap={onBoardTap}>
          {/* <Props /> and landmarks mount here (T44.4) */}
        </Board>
        <PlinthShadow />
      </Suspense>
      <Jumps view={view} />
      <Tokens view={view} />
      <Puffs view={view} />
      <CameraRig view={view} />
    </Canvas>
  );
}
