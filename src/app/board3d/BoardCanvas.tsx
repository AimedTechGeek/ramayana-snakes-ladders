// The 3D diorama canvas: studio lighting, the board (plinth, soil slab, blocks, fog, chips), props and landmarks,
// the die on its tray, the pieces, and a player-driven camera (no automatic follow). The canvas is transparent: the
// page's CSS gradient (app.css `--page-bg`) is the one background behind it.
// Everything sits in board coordinates (boardLayout.ts): props are children of <Board> standing at blockTopY(square);
// the die hangs from TRAY_ANCHOR on the oak ledge.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, type RefObject } from 'react';
import { Mesh, PCFSoftShadowMap, type Object3D } from 'three';
import { bridge } from '../appHooks';
import { Board } from './Board';
import { TRAY_ANCHOR, blockTopY } from './boardLayout';
import { CameraRig } from './Camera';
import { isPhoneWidth } from './cameraConfig';
import { Die, type DieHandle } from './Die';
import type { DioramaView } from './DioramaView';
import { Lighting, PlinthShadow } from './Lighting';
import { BubbleAnchors, Jumps, Puffs, Tokens } from './Pieces';
import { PropsLayer } from './Props';

interface BoardCanvasProps {
  view: DioramaView;
  dieRef: RefObject<DieHandle | null>;
  /** A human may roll: the die bobs and its ring pulses. */
  dieIdle: boolean;
  /** A tap (not a drag) on the die or its tray. */
  onDieTap: () => void;
  /** The die's clatter on each contact with the felt. */
  onDieContact?: () => void;
  reducedMotion: boolean;
}

/** DPR cap: 2 on desktop and tablet, 1.5 for phone-width canvases (spec 1.3). */
function dprCap(): number {
  return isPhoneWidth(window.innerWidth) ? 1.5 : 2;
}

/** Shadow-pass draw calls: one per visible shadow-casting mesh (one directional light). */
function shadowCasters(root: Object3D): number {
  let count = 0;
  root.traverseVisible((node) => {
    if (node instanceof Mesh && node.castShadow) count++;
  });
  return count;
}

/** Frame rate and renderer counters for `window.__app.metrics()` (smoke, devices, the review pack). */
function MetricsProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const frames = useRef({ count: 0, since: performance.now(), fps: 0 });
  useFrame(() => {
    const f = frames.current;
    f.count++;
    const now = performance.now();
    if (now - f.since >= 1000) {
      f.fps = (f.count * 1000) / (now - f.since);
      f.count = 0;
      f.since = now;
    }
  });
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __three: { gl, scene } });
    bridge.metrics = () => {
      const shadow = shadowCasters(scene);
      return {
        fps: Math.round(frames.current.fps * 10) / 10,
        drawCalls: gl.info.render.calls,
        shadowCalls: shadow,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
      };
    };
    return () => {
      bridge.metrics = null;
    };
  }, [gl, scene]);
  return null;
}

export function BoardCanvas({
  view,
  dieRef,
  dieIdle,
  onDieTap,
  onDieContact,
  reducedMotion,
}: BoardCanvasProps) {
  return (
    <Canvas
      dpr={[1, dprCap()]}
      shadows={{ type: PCFSoftShadowMap }}
      camera={{ position: [0, 12, 14], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      data-testid="board-canvas"
    >
      <Lighting />
      <Suspense fallback={null}>
        <Board view={view}>
          <PropsLayer revealed={view.revealedTerrain} blockTopY={blockTopY} />
        </Board>
        <PlinthShadow />
      </Suspense>
      <Die
        position={[TRAY_ANCHOR[0], TRAY_ANCHOR[1], TRAY_ANCHOR[2]]}
        rollRef={dieRef}
        onTap={onDieTap}
        onContact={onDieContact}
        idle={dieIdle}
        reducedMotion={reducedMotion}
      />
      <Jumps view={view} />
      <Tokens view={view} reducedMotion={reducedMotion} />
      <Puffs view={view} />
      <BubbleAnchors view={view} />
      <CameraRig view={view} />
      <MetricsProbe />
    </Canvas>
  );
}
