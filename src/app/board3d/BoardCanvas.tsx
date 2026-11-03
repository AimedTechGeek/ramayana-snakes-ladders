// The 3D diorama canvas: studio lighting, the board (plinth, soil slab, blocks, fog, chips), props and landmarks,
// the die on its tray, the pieces, and a player-driven camera (no automatic follow). The canvas is transparent: the
// page's CSS gradient (app.css `--page-bg`) is the one background behind it.
// Everything sits in board coordinates (boardLayout.ts): props are children of <Board> standing at blockTopY(square);
// the die hangs from TRAY_ANCHOR on the oak ledge.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, type RefObject } from 'react';
import { FloatType, HalfFloatType, Mesh, PCFSoftShadowMap, Texture, type Object3D, type Scene } from 'three';
import type { Locale } from '../../i18n/i18n';
import { bridge } from '../appHooks';
import { Board } from './Board';
import { TRAY_ANCHOR, blockTopY } from './boardLayout';
import { CameraRig } from './Camera';
import { isPhoneWidth } from './cameraConfig';
import { Die, type DieHandle } from './Die';
import type { DioramaView } from './DioramaView';
import { Lighting, PlinthShadow } from './Lighting';
import { BubbleAnchors, Jumps, Puffs, Tokens } from './Pieces';
import { Signposts } from './Signposts';
import { Snakes } from './Snake';
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
  /** The stage signposts are painted in this language (T46.5, T46.6). */
  locale: Locale;
  /** The board has loaded and drawn its first frames (the game's first chapter card waits for it: T46.5). */
  onSceneReady?: () => void;
}

/** Calls `onReady` once, a few frames after the board's Suspense has resolved (so it is on screen, not just mounted). */
function SceneReady({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 3) return;
    if (++frames.current === 3) onReady?.();
  });
  return null;
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

/** Bytes per texel by texture type: half floats 8, floats 16, everything else RGBA8. */
const TEXEL_BYTES: Record<number, number> = { [HalfFloatType]: 8, [FloatType]: 16 };

/**
 * Estimated GPU memory of every texture the scene uses, MB: material maps and shader uniforms plus the environment,
 * RGBA at the texture's type, mipmapped ones a third more. Shadow maps are not counted.
 */
function textureMb(root: Scene): number {
  const seen = new Set<Texture>();
  if (root.environment instanceof Texture) seen.add(root.environment);
  root.traverse((node) => {
    const material = (node as Mesh).material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(m)) if (value instanceof Texture) seen.add(value);
      const uniforms = (m as { uniforms?: Record<string, { value?: unknown }> }).uniforms ?? {};
      for (const uniform of Object.values(uniforms)) if (uniform?.value instanceof Texture) seen.add(uniform.value);
    }
  });
  let bytes = 0;
  for (const texture of seen) {
    const image = texture.image as { width?: number; height?: number } | null;
    const size = (image?.width ?? 0) * (image?.height ?? 0) * (TEXEL_BYTES[texture.type] ?? 4);
    bytes += texture.generateMipmaps ? (size * 4) / 3 : size;
  }
  return Math.round((bytes / 1e6) * 100) / 100;
}

/** Bytes downloaded so far: the document plus every resource (transfer size; body size when served from cache). */
function bytesLoaded(): number {
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource'),
  ] as PerformanceResourceTiming[];
  return entries.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
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
        textureMb: textureMb(scene),
        bytesLoaded: bytesLoaded(),
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
  locale,
  onSceneReady,
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
          <Signposts view={view} locale={locale} />
        </Board>
        <PlinthShadow />
        <SceneReady onReady={onSceneReady} />
      </Suspense>
      <Die
        position={[TRAY_ANCHOR[0], TRAY_ANCHOR[1], TRAY_ANCHOR[2]]}
        // the 1.6 x 1.2 tray lies lengthwise along the 1.4 x 2.0 ledge
        rotationY={Math.PI / 2}
        rollRef={dieRef}
        onTap={onDieTap}
        onContact={onDieContact}
        idle={dieIdle}
        reducedMotion={reducedMotion}
      />
      <Jumps view={view} />
      <Snakes view={view} reducedMotion={reducedMotion} />
      <Tokens view={view} reducedMotion={reducedMotion} />
      <Puffs view={view} />
      <BubbleAnchors view={view} />
      <CameraRig view={view} />
      <MetricsProbe />
    </Canvas>
  );
}
