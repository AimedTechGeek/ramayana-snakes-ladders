// The 144 blocks as one instanced mesh (one draw call), coloured by region; fogged blocks are pale and misted and
// blend to their colour when revealed. The square numbers are one canvas texture laid over the block tops.

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, Color, InstancedMesh, Object3D, SRGBColorSpace } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { regionOf, tileTintOf, type RegionName } from '../../game/board/blockRules';
import { squareWorld } from '../../game/iso/boardIso';
import { CELL, SIZE } from '../../game/iso/world';
import { BLOCK_HEIGHT, BLOCK_TOP, toThree, UNIT } from './coords';
import type { DioramaView } from './DioramaView';

const SQUARES = 144;
/** Placeholder region colours; the design spec replaces them. */
export const REGION_COLOR: Record<RegionName, string> = {
  mithila: '#d6a845',
  ayodhya: '#f0a35e',
  dandaka: '#3f8f5a',
  ganga: '#4f9fd6',
  kishkindha: '#8fb565',
  sea: '#2f74b5',
  lanka: '#a8423a',
};
const FOG = new Color('#c3c9d8');
const FOG_SHARE = 0.78;
/** Fraction of the remaining blend covered per second while fog lifts. */
const REVEAL_RATE = 6;
const TAP_PX = 6;

function revealedColour(square: number): Color {
  const tint = (tileTintOf(square) & 0xff) / 0xff;
  return new Color(REGION_COLOR[regionOf(square)]).multiplyScalar(tint);
}

interface BlocksProps {
  view: DioramaView;
  /** A tap (not a drag) on the board. */
  onTap: () => void;
}

export function Blocks({ view, onTap }: BlocksProps) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(0.94, BLOCK_HEIGHT, 0.94, 2, 0.06), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const targets = useMemo(() => Array.from({ length: SQUARES }, (_, i) => revealedColour(i + 1)), []);
  /** 0 = fogged, 1 = revealed, per square; eased toward the view's reveal state. */
  const shown = useRef(new Float32Array(SQUARES));
  const scratch = useMemo(() => new Color(), []);

  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dummy = new Object3D();
    for (let square = 1; square <= SQUARES; square++) {
      const [x, y] = squareWorld(square);
      dummy.position.set(...toThree([x, y], -BLOCK_HEIGHT / 2));
      dummy.updateMatrix();
      instanced.setMatrixAt(square - 1, dummy.matrix);
      const revealed = view.revealedTerrain.has(square) ? 1 : 0;
      shown.current[square - 1] = revealed;
      instanced.setColorAt(
        square - 1,
        scratch.copy(targets[square - 1]!).lerp(FOG, FOG_SHARE * (1 - revealed)),
      );
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [view, targets, scratch]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    let dirty = false;
    for (let square = 1; square <= SQUARES; square++) {
      const target = view.revealedTerrain.has(square) ? 1 : 0;
      const now = shown.current[square - 1]!;
      if (now === target) continue;
      const next =
        Math.abs(target - now) < 0.01 ? target : now + (target - now) * Math.min(1, delta * REVEAL_RATE);
      shown.current[square - 1] = next;
      instanced.setColorAt(square - 1, scratch.copy(targets[square - 1]!).lerp(FOG, FOG_SHARE * (1 - next)));
      dirty = true;
    }
    if (dirty && instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  const tap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta <= TAP_PX) onTap();
  };

  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, undefined, SQUARES]} onClick={tap} receiveShadow>
        <meshStandardMaterial roughness={0.75} metalness={0} />
      </instancedMesh>
      <Numbers />
      <mesh position={[0, BLOCK_TOP - BLOCK_HEIGHT - 0.12, 0]} receiveShadow>
        <boxGeometry args={[SIZE * UNIT + 0.5, 0.24, SIZE * UNIT + 0.5]} />
        <meshStandardMaterial color="#5a4632" roughness={0.9} />
      </mesh>
    </group>
  );
}

const PX_PER_CELL = 128;

/** Every square number drawn once into a texture the size of the board, laid just above the block tops. */
function Numbers() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PX_PER_CELL * 12;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const scale = PX_PER_CELL / CELL;
      ctx.font = `700 ${PX_PER_CELL * 0.3}px "Noto Sans", system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      for (let square = 1; square <= SQUARES; square++) {
        const [x, y] = squareWorld(square);
        const left = (x - CELL / 2) * scale + PX_PER_CELL * 0.1;
        const top = (y - CELL / 2) * scale + PX_PER_CELL * 0.08;
        ctx.lineWidth = PX_PER_CELL * 0.06;
        ctx.strokeStyle = 'rgba(255, 248, 225, 0.9)';
        ctx.strokeText(String(square), left, top);
        ctx.fillStyle = '#2b2118';
        ctx.fillText(String(square), left, top);
      }
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BLOCK_TOP + 0.004, 0]}>
      <planeGeometry args={[SIZE * UNIT, SIZE * UNIT]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
