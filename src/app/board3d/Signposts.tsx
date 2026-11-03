// Stage signposts (T46.6): a small wooden signpost on each stage's first block, at a prop's scale (layout and the
// painted atlas: signpostLayout.ts). All eight are one merged mesh (one draw call, one shadow caster): a foot stone, a
// post with a cap and a board whose front face reads its cell of a canvas atlas drawn in the current language (redrawn
// on a language switch). A signpost on a fogged block stays in view, tarnished but legible (a name is not a spoiler).

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stageKey } from '../../game/stages';
import { t, type Locale } from '../../i18n/i18n';
import type { DioramaView } from './DioramaView';
import { DAIS_HEIGHT } from './propLayout';
import { easeToward } from './scenery';
import {
  SIGN_BOARD_BOTTOM,
  SIGN_BOARD_DEPTH,
  SIGN_BOARD_HEIGHT,
  SIGN_BOARD_WIDTH,
  SIGN_FOOT,
  SIGN_FOOT_HEIGHT,
  SIGN_HEIGHT,
  SIGN_NAME_FONT,
  SIGN_POST,
  SIGN_SUB_FONT,
  drawSignAtlas,
  signUvCell,
  signpostFootY,
  signpostSpots,
  type SignLabel,
  type SignpostSpot,
} from './signpostLayout';

const POST_WOOD = '#6B4528';
const CAP_WOOD = '#4F3220';
const BOARD_WOOD = '#7A5130';
const FOOT_STONE = '#8F877A';
const CAP = 0.056;
const CAP_HEIGHT = 0.02;
/** BoxGeometry's +z face (the board's front) is its fifth group of four vertices. */
const FRONT_FACE = [16, 17, 18, 19] as const;

function labelsFor(spots: readonly SignpostSpot[]): SignLabel[] {
  return spots.map(({ id }) => ({
    name: t(stageKey(id, 'name')),
    sub: t(stageKey(id, 'kanda')) || t(stageKey(id, 'line')),
  }));
}

/** One box of a signpost, local to its post's foot, in a flat colour; `cell` maps the front face to an atlas cell. */
function part(
  size: readonly [number, number, number],
  centre: readonly [number, number, number],
  colour: string,
  cell?: ReturnType<typeof signUvCell>,
): BufferGeometry {
  const box = new BoxGeometry(...size).translate(...centre);
  const count = box.getAttribute('position').count;
  const rgb = new Color(colour);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colours.set([rgb.r, rgb.g, rgb.b], i * 3);
  const face = new Float32Array(count);
  if (cell) {
    const uv = box.getAttribute('uv');
    for (const i of FRONT_FACE) {
      uv.setXY(i, cell.u + uv.getX(i) * cell.width, cell.v + uv.getY(i) * cell.height);
      face[i] = 1;
    }
  }
  box.setAttribute('color', new BufferAttribute(colours, 3));
  box.setAttribute('aFace', new BufferAttribute(face, 1));
  return box;
}

/** A whole signpost standing at its spot: foot stone, post, cap and board. */
function signpostGeometry(spot: SignpostSpot, index: number): BufferGeometry {
  const postHeight = SIGN_HEIGHT - CAP_HEIGHT;
  const parts = [
    part([SIGN_FOOT, SIGN_FOOT_HEIGHT, SIGN_FOOT], [0, SIGN_FOOT_HEIGHT / 2 - 0.005, 0], FOOT_STONE),
    part([SIGN_POST, postHeight, SIGN_POST], [0, postHeight / 2, 0], POST_WOOD),
    part([CAP, CAP_HEIGHT, CAP], [0, SIGN_HEIGHT - CAP_HEIGHT / 2, 0], CAP_WOOD),
    part(
      [SIGN_BOARD_WIDTH, SIGN_BOARD_HEIGHT, SIGN_BOARD_DEPTH],
      [spot.boardOffset, SIGN_BOARD_BOTTOM + SIGN_BOARD_HEIGHT / 2, SIGN_POST / 2 + SIGN_BOARD_DEPTH / 2],
      BOARD_WOOD,
      signUvCell(index),
    ),
  ];
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  const place = new Matrix4()
    .makeRotationY(spot.yaw)
    .setPosition(spot.at[0], signpostFootY(spot.square, DAIS_HEIGHT), spot.at[1]);
  return merged.applyMatrix4(place);
}

/**
 * Lit wood in vertex colours; the board's front face (`aFace` 1) shows its atlas cell instead, and `aDim` (per
 * signpost) tarnishes a signpost whose block is still fogged: less colour, a little darker, the paint as crisp.
 */
function signpostMaterial(atlas: CanvasTexture): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    map: atlas,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aFace;\nattribute float aDim;\nvarying float vFace;\nvarying float vDim;',
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFace = aFace;\nvDim = aDim;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFace;\nvarying float vDim;')
      .replace('#include <map_fragment>', '')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 paint = texture2D(map, vMapUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, paint.rgb, vFace * paint.a);
        float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.5 * vDim) * (1.0 - 0.2 * vDim);`,
      );
  };
  material.customProgramCacheKey = () => 'signpost';
  return material;
}

/** Sets signpost `index`'s tarnish on all its vertices. */
function writeDim(geometry: BufferGeometry, starts: readonly number[], index: number, value: number): void {
  const attribute = geometry.getAttribute('aDim') as BufferAttribute;
  (attribute.array as Float32Array).fill(value, starts[index], starts[index + 1]);
  attribute.needsUpdate = true;
}

export function Signposts({ view, locale }: { view: DioramaView; locale: Locale }) {
  const mesh = useRef<Mesh>(null);
  const spots = useMemo(signpostSpots, []);
  const texture = useMemo(() => {
    // sized and drawn before the texture exists: a GPU texture keeps the size of its first upload
    const canvas = document.createElement('canvas');
    drawSignAtlas(canvas, labelsFor(spots));
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [spots]);
  // Paint for the language now, and again once Eczar's two weights are in (fonts.ready alone does not fetch a weight
  // no element uses yet).
  useEffect(() => {
    let live = true;
    const draw = (): void => {
      if (!live) return;
      drawSignAtlas(texture.image as HTMLCanvasElement, labelsFor(spots));
      texture.needsUpdate = true;
    };
    draw();
    const fonts = document.fonts;
    if (fonts)
      void Promise.all([SIGN_NAME_FONT, SIGN_SUB_FONT].map((font) => fonts.load(font).catch(() => [])))
        .then(() => fonts.ready)
        .then(draw);
    return () => {
      live = false;
    };
  }, [texture, spots, locale]);

  /** The merged geometry and where each signpost's vertices start (for its `aDim`). */
  const { geometry, starts } = useMemo(() => {
    const each = spots.map(signpostGeometry);
    const starts = [0];
    for (const g of each) starts.push(starts[starts.length - 1]! + g.getAttribute('position').count);
    const merged = mergeGeometries(each);
    each.forEach((g) => g.dispose());
    const dim = new BufferAttribute(new Float32Array(starts[starts.length - 1]!), 1);
    dim.setUsage(35048); // DynamicDrawUsage
    merged.setAttribute('aDim', dim);
    return { geometry: merged, starts };
  }, [spots]);
  const material = useMemo(() => signpostMaterial(texture), [texture]);
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
    // snap to each block's state at mount; later changes ease in useFrame
    spots.forEach((spot, i) => {
      dims.current[i] = view.revealedTerrain.has(spot.square) ? 0 : 1;
      writeDim(geometry, starts, i, dims.current[i]!);
    });
    if (mesh.current) mesh.current.raycast = () => undefined;
  }, [spots, geometry, starts, view]);

  useFrame((_, delta) => {
    spots.forEach((spot, i) => {
      const target = view.revealedTerrain.has(spot.square) ? 0 : 1;
      const next = easeToward(dims.current[i]!, target, delta);
      if (next === dims.current[i]) return;
      dims.current[i] = next;
      writeDim(geometry, starts, i, next);
    });
  });

  return (
    <mesh ref={mesh} name="signposts" geometry={geometry} material={material} castShadow receiveShadow />
  );
}
