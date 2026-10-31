// The diorama's scenery (T44 2.4): ~50 prop kinds from one GLB, each kind ONE InstancedMesh (plus one more for its
// glowing part), placed by the T42 seed rule. Props of fogged blocks are scaled to 0 and pop in when revealed.
// Self-contained: mount <PropsLayer revealed={...} /> inside the R3F Canvas.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D, type BufferGeometry, type Material } from 'three';
import { Ambient } from './Ambient';
import { Landmarks } from './Landmarks';
import {
  layoutInstances,
  MANIFEST_KINDS,
  defaultBlockTopY,
  type BlockTopY,
  type PropInstance,
} from './propLayout';
import {
  bodyMaterial,
  easeToward,
  glowMaterial,
  kindGeometry,
  popScale,
  prefersReducedMotion,
  sceneryUniforms,
  usePropsScene,
} from './scenery';

export interface SceneryProps {
  /** Squares whose terrain is revealed (read every frame, so a mutating Set works). Hidden blocks hide their props. */
  revealed: ReadonlySet<number>;
  /** Height of a block's top face in three units; defaults to the current board's flat top. */
  blockTopY?: BlockTopY;
}

/** Kinds at least this tall (px) cast shadows: trees, huts, posts, animals, bushes (contact shadows sell the clay). */
const TALL_PX = 10;

interface KindMeshProps {
  kind: string;
  instances: PropInstance[];
  revealed: ReadonlySet<number>;
  geometry: BufferGeometry;
  material: Material;
  glow?: boolean;
}

/** One kind: an InstancedMesh whose matrices follow the reveal state of each instance's square. */
function KindMesh({ kind, instances, revealed, geometry, material, glow = false }: KindMeshProps) {
  const mesh = useRef<InstancedMesh>(null);
  const shown = useRef(new Float32Array(instances.length));
  const dummy = useMemo(() => new Object3D(), []);
  const tall = (MANIFEST_KINDS[kind]?.height ?? 0) >= TALL_PX;

  const write = (index: number, amount: number): void => {
    const inst = instances[index]!;
    dummy.position.set(...inst.position);
    dummy.rotation.set(0, inst.yaw, 0);
    dummy.scale.setScalar(Math.max(popScale(amount) * inst.scale, 0.0001));
    dummy.updateMatrix();
    mesh.current?.setMatrixAt(index, dummy.matrix);
  };

  useEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    instances.forEach((inst, index) => {
      const now = revealed.has(inst.square) ? 1 : 0;
      shown.current[index] = now;
      write(index, now);
    });
    instanced.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `write` only closes over refs and stable values
  }, [instances]);

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    let dirty = false;
    instances.forEach((inst, index) => {
      const target = revealed.has(inst.square) ? 1 : 0;
      const now = shown.current[index]!;
      if (now === target) return;
      const next = easeToward(now, target, delta);
      shown.current[index] = next;
      write(index, next);
      dirty = true;
    });
    if (dirty) instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      name={glow ? `${kind}__glow` : kind}
      args={[geometry, material, instances.length]}
      frustumCulled={false}
      castShadow={tall && !glow}
      receiveShadow={!glow}
    />
  );
}

/** All instanced props. Also advances the shared clock the sway / shimmer / flow shaders read. */
export function Props({ revealed, blockTopY = defaultBlockTopY }: SceneryProps) {
  const scene = usePropsScene();
  const byKind = useMemo(() => {
    const groups = new Map<string, PropInstance[]>();
    for (const inst of layoutInstances(blockTopY)) {
      const list = groups.get(inst.kind);
      if (list) list.push(inst);
      else groups.set(inst.kind, [inst]);
    }
    return [...groups].map(([kind, instances]) => ({ kind, instances, ...kindGeometry(scene, kind) }));
  }, [scene, blockTopY]);

  useFrame((_, delta) => {
    sceneryUniforms.uMotion.value = prefersReducedMotion() ? 0 : 1;
    sceneryUniforms.uTime.value += delta;
  });

  return (
    <group name="props">
      {byKind.map(({ kind, instances, body, glow }) => {
        const anim = MANIFEST_KINDS[kind]?.anim ?? 'none';
        return (
          <group key={kind}>
            {body && (
              <KindMesh
                kind={kind}
                instances={instances}
                revealed={revealed}
                geometry={body}
                material={bodyMaterial(anim)}
              />
            )}
            {glow && (
              <KindMesh
                kind={kind}
                instances={instances}
                revealed={revealed}
                geometry={glow}
                material={glowMaterial(kind)}
                glow
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Props + landmarks + ambient life in one mount: the single line the board canvas needs. */
export function PropsLayer({ revealed, blockTopY = defaultBlockTopY }: SceneryProps) {
  return (
    <>
      <Props revealed={revealed} blockTopY={blockTopY} />
      <Landmarks revealed={revealed} blockTopY={blockTopY} />
      <Ambient revealed={revealed} blockTopY={blockTopY} />
    </>
  );
}
