// Individually modelled landmarks (T44 2.5): the Ayodhya gate on the rim south of block 1, Janaka's palace on 36, and
// the coronation set on 144 (dais ring, EMPTY throne, chhatra planted on the rim behind so no token stands under it).
// Each pops in when its block is revealed (squares 1 and 144 are known from the first roll).

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, type BufferGeometry } from 'three';
import { FINAL_SQUARE } from '../../game/board/blockRules';
import { coronationSpots, defaultBlockTopY, gatePosition, palaceYaw, PROP_LAYOUT, spotOf } from './propLayout';
import { bodyMaterial, easeToward, glowMaterial, kindGeometry, popScale, useLandmarksScene } from './scenery';
import type { SceneryProps } from './Props';

interface LandmarkProps extends SceneryProps {
  /** Top of the rim the gate stands on, three units; defaults to the top of block 1. */
  rimTopY?: number;
}

interface PieceProps {
  name: string;
  square: number;
  position: [number, number, number];
  yaw?: number;
  revealed: ReadonlySet<number>;
  body?: BufferGeometry;
  glow?: BufferGeometry;
  cast?: boolean;
}

function Piece({ name, square, position, yaw = 0, revealed, body, glow, cast = true }: PieceProps) {
  const group = useRef<Group>(null);
  const shown = useRef(revealed.has(square) ? 1 : 0);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    shown.current = easeToward(shown.current, revealed.has(square) ? 1 : 0, delta);
    node.scale.setScalar(Math.max(popScale(shown.current), 0.0001));
    node.visible = shown.current > 0.001;
  });
  return (
    <group ref={group} name={name} position={position} rotation={[0, yaw, 0]}>
      {body && <mesh geometry={body} material={bodyMaterial('none')} castShadow={cast} receiveShadow />}
      {glow && <mesh geometry={glow} material={glowMaterial(name)} />}
    </group>
  );
}

export function Landmarks({ revealed, blockTopY = defaultBlockTopY, rimTopY }: LandmarkProps) {
  const scene = useLandmarksScene();
  const geo = useMemo(
    () => ({
      gate: kindGeometry(scene, 'ayodhya-threshold'),
      palace: kindGeometry(scene, 'janaka-palace'),
      dais: kindGeometry(scene, 'dais'),
      throne: kindGeometry(scene, 'throne'),
      chhatra: kindGeometry(scene, 'chhatra'),
    }),
    [scene],
  );
  const gate = gatePosition(rimTopY ?? blockTopY(1));
  const coronation = coronationSpots(blockTopY(FINAL_SQUARE));
  const palaceSquare = 36;
  const palace = PROP_LAYOUT[palaceSquare]?.find((p) => p.kind === 'janaka-palace');
  const palacePosition = palace ? spotOf(palaceSquare, palace.x, palace.y, blockTopY(palaceSquare)) : null;

  return (
    <group name="landmarks">
      <Piece name="ayodhya-threshold" square={1} position={gate} revealed={revealed} {...geo.gate} />
      {palace && palacePosition && (
        // the long hall faces the block centre: the front (+z) turns toward +x on a left strip, -x on a right one
        <Piece
          name="janaka-palace"
          square={palaceSquare}
          position={palacePosition}
          yaw={palaceYaw(palace.x)}
          revealed={revealed}
          {...geo.palace}
        />
      )}
      <Piece
        name="dais"
        square={FINAL_SQUARE}
        position={coronation.dais}
        revealed={revealed}
        {...geo.dais}
        cast={false}
      />
      <Piece
        name="throne"
        square={FINAL_SQUARE}
        position={coronation.throne}
        revealed={revealed}
        {...geo.throne}
      />
      <Piece
        name="chhatra"
        square={FINAL_SQUARE}
        position={coronation.pole}
        revealed={revealed}
        {...geo.chhatra}
      />
    </group>
  );
}
