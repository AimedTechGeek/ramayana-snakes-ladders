// Stage name plaques (T46.5): one instanced billboard quad per stage on the board's edge beside its first row, read
// from a canvas atlas drawn in the current language (redrawn on a language switch). A plaque whose stage no token
// has reached yet shows dimmed but readable. Layout and drawing: plaqueLayout.ts; shader: boardMaterials.plaqueMaterial.

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { stageKey } from '../../game/stages';
import { t, type Locale } from '../../i18n/i18n';
import { plaqueMaterial } from './boardMaterials';
import type { DioramaView } from './DioramaView';
import {
  PLAQUE_HEIGHT,
  PLAQUE_NAME_FONT,
  PLAQUE_SUB_FONT,
  PLAQUE_WIDTH,
  drawPlaqueAtlas,
  plaqueSpots,
  plaqueUvOrigin,
  stageReached,
  type PlaqueLabel,
  type PlaqueSpot,
} from './plaqueLayout';
import { easeToward } from './scenery';

function labelsFor(spots: readonly PlaqueSpot[]): PlaqueLabel[] {
  return spots.map(({ id, alignX }) => ({
    name: t(stageKey(id, 'name')),
    sub: t(stageKey(id, 'kanda')) || t(stageKey(id, 'line')),
    alignX,
  }));
}

export function Plaques({ view, locale }: { view: DioramaView; locale: Locale }) {
  const mesh = useRef<InstancedMesh>(null);
  const spots = useMemo(plaqueSpots, []);
  const texture = useMemo(() => {
    const map = new CanvasTexture(document.createElement('canvas'));
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, []);
  // Draw for the language now, and again once Eczar's two weights are in (fonts.ready alone does not fetch a weight
  // no element uses yet).
  useEffect(() => {
    let live = true;
    const draw = (): void => {
      if (!live) return;
      drawPlaqueAtlas(texture.image as HTMLCanvasElement, labelsFor(spots));
      texture.needsUpdate = true;
    };
    draw();
    const fonts = document.fonts;
    if (fonts)
      void Promise.all([PLAQUE_NAME_FONT, PLAQUE_SUB_FONT].map((font) => fonts.load(font).catch(() => [])))
        .then(() => fonts.ready)
        .then(draw);
    return () => {
      live = false;
    };
  }, [texture, spots, locale]);

  const geometry = useMemo(() => {
    const quad = new PlaneGeometry(PLAQUE_WIDTH, PLAQUE_HEIGHT);
    const origins = new Float32Array(spots.length * 2);
    const aligns = new Float32Array(spots.length * 2);
    spots.forEach((spot, i) => {
      const [u, v] = plaqueUvOrigin(i);
      origins[i * 2] = u;
      origins[i * 2 + 1] = v;
      aligns[i * 2] = spot.alignX;
      aligns[i * 2 + 1] = spot.alignY;
    });
    quad.setAttribute('aOrigin', new InstancedBufferAttribute(origins, 2));
    quad.setAttribute('aAlign', new InstancedBufferAttribute(aligns, 2));
    const dim = new InstancedBufferAttribute(new Float32Array(spots.length), 1);
    dim.setUsage(35048);
    quad.setAttribute('aDim', dim);
    return quad;
  }, [spots]);
  const material = useMemo(() => plaqueMaterial(texture), [texture]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
    [geometry, material, texture],
  );

  const dims = useRef(new Float32Array(spots.length));
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dummy = new Object3D();
    const attribute = geometry.getAttribute('aDim') as InstancedBufferAttribute;
    spots.forEach((spot, i) => {
      dummy.position.set(...spot.position);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
      // snap to the stage's state at mount; later changes ease in useFrame
      dims.current[i] = stageReached(spot.id, view.revealedTerrain) ? 0 : 1;
      attribute.setX(i, dims.current[i]!);
    });
    attribute.needsUpdate = true;
    instanced.instanceMatrix.needsUpdate = true;
    instanced.raycast = () => undefined;
  }, [spots, geometry, view]);

  useFrame((_, delta) => {
    const attribute = geometry.getAttribute('aDim') as InstancedBufferAttribute;
    let changed = false;
    spots.forEach((spot, i) => {
      const target = stageReached(spot.id, view.revealedTerrain) ? 0 : 1;
      const next = easeToward(dims.current[i]!, target, delta);
      if (next === dims.current[i]) return;
      dims.current[i] = next;
      attribute.setX(i, next);
      changed = true;
    });
    if (changed) attribute.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      name="plaques"
      args={[geometry, material, spots.length]}
      frustumCulled={false}
      renderOrder={9}
    />
  );
}
