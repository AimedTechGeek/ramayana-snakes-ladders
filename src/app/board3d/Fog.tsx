// Fog of war visuals (T44 spec 3): 432 instanced mist blobs over hidden blocks and the always-visible number chips.
// The per-block `aFog` desaturation lives in boardMaterials.blockMaterial; the eased values come from fogField.ts.

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  CanvasTexture,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { seedOf } from '../../game/board/blockRules';
import type { FogState } from './Board';
import { SQUARES, blockTopY, chipAnchor, squareCentre } from './boardLayout';
import { chipMaterial, mistMaterial } from './boardMaterials';
import { CHIP_HEIGHT, CHIP_WIDTH, chipUvOrigin, drawChipAtlas } from './chips';
import type { DioramaView } from './DioramaView';

const BLOBS_PER_BLOCK = 3;
const MIST_LIFT = 0.15;

/** Where the three blobs of a block sit (offsets in u from the block centre) and their radii, from the square seed. */
export function mistBlobs(square: number): { dx: number; dz: number; radius: number }[] {
  const seed = seedOf(square);
  return Array.from({ length: BLOBS_PER_BLOCK }, (_, k) => {
    const angle = ((k + ((seed >>> 4) % 7) / 7) * 2 * Math.PI) / BLOBS_PER_BLOCK;
    const reach = 0.12 + (((seed >>> (8 + k * 3)) & 7) / 7) * 0.1;
    return {
      dx: Math.cos(angle) * reach,
      dz: Math.sin(angle) * reach,
      radius: 0.22 + (((seed >>> (12 + k * 4)) & 15) / 15) * 0.08,
    };
  });
}

export function Mist({ fog }: { fog: FogState }) {
  const mesh = useRef<InstancedMesh>(null);
  const seen = useRef(-1);
  const count = SQUARES * BLOBS_PER_BLOCK;
  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const reveal = useMemo(() => {
    const attribute = new InstancedBufferAttribute(new Float32Array(count), 1);
    attribute.setUsage(35048);
    geometry.setAttribute('aReveal', attribute);
    return attribute;
  }, [geometry, count]);
  const material = useMemo(mistMaterial, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dummy = new Object3D();
    for (let square = 1; square <= SQUARES; square++) {
      const [x, z] = squareCentre(square);
      mistBlobs(square).forEach((blob, k) => {
        dummy.position.set(x + blob.dx, blockTopY(square) + MIST_LIFT, z + blob.dz);
        dummy.scale.setScalar(blob.radius);
        dummy.updateMatrix();
        instanced.setMatrixAt((square - 1) * BLOBS_PER_BLOCK + k, dummy.matrix);
      });
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.raycast = () => undefined;
  }, []);

  useFrame(() => {
    if (seen.current === fog.version) return;
    seen.current = fog.version;
    for (let square = 1; square <= SQUARES; square++) {
      const revealed = 1 - fog.field.values[square]!;
      for (let k = 0; k < BLOBS_PER_BLOCK; k++) reveal.setX((square - 1) * BLOBS_PER_BLOCK + k, revealed);
    }
    reveal.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      name="mist"
      args={[geometry, material, count]}
      frustumCulled={false}
      renderOrder={5}
    />
  );
}

/** One billboard chip per square, always visible, fogged or not. Bridge tops pin theirs at the front-right corner. */
export function Chips({ view }: { view: DioramaView }) {
  useSyncExternalStore(view.subscribe, view.getVersion);
  const mesh = useRef<InstancedMesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    drawChipAtlas(canvas);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => {
    // Redraw once the web fonts are in, so the digits use the UI font.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (!live) return;
      drawChipAtlas(texture.image as HTMLCanvasElement);
      texture.needsUpdate = true;
    });
    return () => {
      live = false;
    };
  }, [texture]);
  const geometry = useMemo(() => {
    const quad = new PlaneGeometry(CHIP_WIDTH, CHIP_HEIGHT);
    const origins = new Float32Array(SQUARES * 2);
    for (let square = 1; square <= SQUARES; square++) {
      const [u, v] = chipUvOrigin(square);
      origins[(square - 1) * 2] = u;
      origins[(square - 1) * 2 + 1] = v;
    }
    quad.setAttribute('aOrigin', new InstancedBufferAttribute(origins, 2));
    return quad;
  }, []);
  const material = useMemo(() => chipMaterial(texture), [texture]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
    [geometry, material, texture],
  );

  const bridgeTops = view.setup?.board.ladders.map((jump) => jump.to).join(',') ?? '';
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const tops = new Set(bridgeTops ? bridgeTops.split(',').map(Number) : []);
    const dummy = new Object3D();
    for (let square = 1; square <= SQUARES; square++) {
      const [x, y, z] = chipAnchor(square, tops.has(square));
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      instanced.setMatrixAt(square - 1, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.raycast = () => undefined;
  }, [bridgeTops]);

  return (
    <instancedMesh
      ref={mesh}
      name="chips"
      args={[geometry, material, SQUARES]}
      frustumCulled={false}
      renderOrder={10}
    />
  );
}
