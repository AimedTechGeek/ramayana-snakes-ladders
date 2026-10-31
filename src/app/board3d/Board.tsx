// The board as a diorama object (T44 spec 2): oak plinth, soil-strata slab, brass rail and posts, the 144 blocks as 14
// instanced variants at their region heights, water shader for Ganga and the sea, and the fog of war (Fog.tsx).
// Meshes come from public/models/board/board.glb (scripts/blender/board.py). Props, landmarks and the die mount as
// `children` inside this group, in board coordinates (see boardLayout.ts: PROPS_ORIGIN, TRAY_ANCHOR).

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import {
  Color,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type InstancedBufferAttribute,
  type Mesh,
} from 'three';
import { regionOf, tileTintOf } from '../../game/board/blockRules';
import { BLOCK_HALF, blockHeight, blockTopY, squareCentre, squaresByVariant } from './boardLayout';
import {
  addInstanceFloat,
  blockMaterial,
  brassMaterial,
  clayMaterial,
  sharedStill,
  sharedTime,
  waterMaterial,
} from './boardMaterials';
import type { DioramaView } from './DioramaView';
import { FogField } from './fogField';
import { Chips, Mist } from './Fog';

export const BOARD_URL = `${import.meta.env.BASE_URL}models/board/board.glb`;
const TAP_MS = 300;
const TAP_PX = 8;

/** A fog field that carries a version so instanced meshes know when to re-upload. */
export interface FogState {
  field: FogField;
  version: number;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function disposeOnUnmount(...items: { dispose(): void }[]): () => void {
  return () => items.forEach((item) => item.dispose());
}

function BlockSet({
  name,
  squares,
  source,
  material,
  fog,
}: {
  name: string;
  squares: number[];
  source: BufferGeometry;
  material: ReturnType<typeof blockMaterial>;
  fog: FogState;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const seen = useRef(-1);
  const geometry = useMemo(() => {
    const clone = source.clone();
    addInstanceFloat(clone, 'aHeight', squares.length);
    addInstanceFloat(clone, 'aFog', squares.length, 1);
    return clone;
  }, [source, squares.length]);
  useEffect(() => disposeOnUnmount(geometry), [geometry]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dummy = new Object3D();
    const tint = new Color();
    const heights = geometry.getAttribute('aHeight') as InstancedBufferAttribute;
    squares.forEach((square, i) => {
      const [x, z] = squareCentre(square);
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
      const grey = (tileTintOf(square) & 0xff) / 0xff;
      instanced.setColorAt(i, tint.setRGB(grey, grey, grey));
      heights.setX(i, blockHeight(square));
    });
    heights.needsUpdate = true;
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    seen.current = -1;
  }, [squares, geometry]);

  useFrame(() => {
    if (seen.current === fog.version) return;
    seen.current = fog.version;
    const attribute = geometry.getAttribute('aFog') as InstancedBufferAttribute;
    squares.forEach((square, i) => attribute.setX(i, fog.field.values[square]!));
    attribute.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      name={`block-${name}`}
      args={[geometry, material, squares.length]}
      frustumCulled={false}
      receiveShadow
    />
  );
}

const WATER = {
  ganga: { deep: '#5A8FA6', shallow: '#78BBD2' },
  sea: { deep: '#4F93B3', shallow: '#6AAECB' },
} as const;

function WaterSurface({ region, fog }: { region: 'ganga' | 'sea'; fog: FogState }) {
  const mesh = useRef<InstancedMesh>(null);
  const seen = useRef(-1);
  const squares = useMemo(
    () => Array.from({ length: 144 }, (_, i) => i + 1).filter((square) => regionOf(square) === region),
    [region],
  );
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(BLOCK_HALF * 2, BLOCK_HALF * 2).rotateX(-Math.PI / 2);
    addInstanceFloat(plane, 'aFog', squares.length, 1);
    return plane;
  }, [squares.length]);
  const material = useMemo(() => waterMaterial(WATER[region]), [region]);
  useEffect(() => disposeOnUnmount(geometry, material), [geometry, material]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dummy = new Object3D();
    squares.forEach((square, i) => {
      const [x, z] = squareCentre(square);
      dummy.position.set(x, blockTopY(square), z);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  }, [squares]);

  useFrame(() => {
    if (seen.current === fog.version) return;
    seen.current = fog.version;
    const attribute = geometry.getAttribute('aFog') as InstancedBufferAttribute;
    squares.forEach((square, i) => attribute.setX(i, fog.field.values[square]!));
    attribute.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      name={`water-${region}`}
      args={[geometry, material, squares.length]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

interface BoardProps {
  view: DioramaView;
  /** A tap (not a drag) on the board. */
  onTap: () => void;
  /** Props, landmarks, the die: mounted in board coordinates. */
  children?: ReactNode;
}

export function Board({ view, onTap, children }: BoardProps) {
  const gltf = useGLTF(BOARD_URL, false);
  const nodes = gltf.nodes as Record<string, Mesh>;
  const clay = useMemo(clayMaterial, []);
  const brass = useMemo(brassMaterial, []);
  const blocks = useMemo(blockMaterial, []);
  useEffect(() => disposeOnUnmount(clay, brass, blocks), [clay, brass, blocks]);
  const byVariant = useMemo(() => squaresByVariant(), []);

  const fog = useMemo<FogState>(() => ({ field: new FogField(), version: 0 }), []);
  const lastSetup = useRef<unknown>(null);
  const reduced = useMemo(prefersReducedMotion, []);
  useEffect(() => {
    sharedStill.value = reduced ? 1 : 0;
  }, [reduced]);
  useFrame(({ clock }) => {
    sharedTime.value = clock.elapsedTime;
    if (lastSetup.current !== view.setup) {
      lastSetup.current = view.setup;
      fog.field.snap(view.revealedTerrain);
      fog.version++;
      return;
    }
    const duration = reduced ? 0 : view.revealMs;
    if (fog.field.update(view.revealedTerrain, performance.now(), duration)) fog.version++;
  });
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __board?: unknown }).__board = { view, fog, info: gl.info };
  }, [view, fog, gl]);

  useSyncExternalStore(view.subscribe, view.getVersion);
  const down = useRef({ at: 0 });
  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    down.current.at = event.nativeEvent.timeStamp;
  };
  const onClick = (event: ThreeEvent<MouseEvent>) => {
    const elapsed = event.nativeEvent.timeStamp - down.current.at;
    if (event.delta <= TAP_PX && elapsed <= TAP_MS) onTap();
  };

  return (
    <group name="board" onPointerDown={onPointerDown} onClick={onClick}>
      <mesh name="plinth" geometry={nodes.Plinth!.geometry} material={clay} receiveShadow castShadow />
      <mesh name="slab" geometry={nodes.Slab!.geometry} material={clay} receiveShadow />
      <mesh name="brass" geometry={nodes.Brass!.geometry} material={brass} receiveShadow castShadow />
      {[...byVariant].map(([variant, squares]) => (
        <BlockSet
          key={variant}
          name={variant}
          squares={squares}
          source={nodes[`Block_${variant.replace('-', '_')}`]!.geometry}
          material={blocks}
          fog={fog}
        />
      ))}
      <WaterSurface region="ganga" fog={fog} />
      <WaterSurface region="sea" fog={fog} />
      <Mist fog={fog} />
      <Chips view={view} />
      {children}
    </group>
  );
}

useGLTF.preload(BOARD_URL, false);
