// Materials of the diorama board: vertex-colour clay with the per-instance fog and height patch, brass, drifting mist,
// the water shader and the chip billboard shader (T44 spec 1.2, 2.5, 2.6, 2.8, 3).

import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  ShaderMaterial,
  type BufferGeometry,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { BLOCK_H0 } from './boardLayout';
import { ATLAS_GRID } from './chips';
import { PLAQUE_ATLAS_SIZE, PLAQUE_CELL_HEIGHT, PLAQUE_HEIGHT, PLAQUE_WIDTH } from './plaqueLayout';

/** Time uniform shared by the animated materials; Board.tsx advances it every frame. */
export const sharedTime = { value: 0 };
/** 1 when reduced motion is on: water and mist hold still. */
export const sharedStill = { value: 0 };

const FOG_GREY = new Color('#CFCCC4');

export function clayMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
}

export function brassMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.9 });
}

/** Fog grey vector shared by the GLSL below. */
const FOG_GLSL = `
  vec3 fogTint(vec3 base, float fog) {
    float luma = dot(base, vec3(0.299, 0.587, 0.114));
    vec3 desat = mix(base, vec3(luma), 0.7 * fog);
    return mix(desat, uFogGrey * (0.6 + 0.8 * luma), 0.7 * fog);
  }
`;

/** Block clay: per-instance aHeight slides the top region to the block's height, aFog greys it (aFog 0..1). */
export function blockMaterial(): MeshStandardMaterial {
  const material = clayMaterial();
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uFogGrey = { value: FOG_GREY };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aHeight;
         attribute float aFog;
         varying float vFog;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float t = ${(BLOCK_H0 - 0.05).toFixed(3)};
           float k = (aHeight - 0.05) / t;
           transformed.y = transformed.y >= t ? transformed.y + (aHeight - ${BLOCK_H0.toFixed(3)}) : transformed.y * k;
           vFog = aFog;
         }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uFogGrey;
         varying float vFog;
         ${FOG_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb = fogTint(diffuseColor.rgb, vFog);`,
      );
  };
  material.customProgramCacheKey = () => 'diorama-block';
  return material;
}

/** Per-instance float attributes on a geometry (aHeight, aFog), returned for in-place updates. */
export function addInstanceFloat(
  geometry: BufferGeometry,
  name: string,
  count: number,
  fill = 0,
): InstancedBufferAttribute {
  const attribute = new InstancedBufferAttribute(new Float32Array(count).fill(fill), 1);
  attribute.setUsage(35048); // DynamicDrawUsage
  geometry.setAttribute(name, attribute);
  return attribute;
}

/** Mist blobs: `aReveal` 0 (hidden) .. 1 (revealed) grows the blob 1 -> 1.35 and fades it out, then hides it. */
export function mistMaterial(): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: '#F4F4F8',
    roughness: 1,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uStill = sharedStill;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aReveal;
         varying float vReveal;
         uniform float uTime;
         uniform float uStill;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vReveal = aReveal;
         transformed *= aReveal >= 1.0 ? 0.0 : 1.0 + 0.35 * aReveal;
         float phase = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
         transformed.x += sin(uTime * 1.047 + phase) * 0.06 * (1.0 - uStill);
         transformed.z += cos(uTime * 1.047 + phase * 1.3) * 0.06 * (1.0 - uStill);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n varying float vReveal;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.a *= 0.62 * (1.0 - vReveal);`,
      );
  };
  material.customProgramCacheKey = () => 'diorama-mist';
  return material;
}

export interface WaterColors {
  deep: string;
  shallow: string;
}

/** Water surface (Ganga, sea): wobbling normals, sparkle, Fresnel tint to white, edge foam, greyed and still in fog. */
export function waterMaterial(colors: WaterColors): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: sharedTime,
      uStill: sharedStill,
      uDeep: { value: new Color(colors.deep) },
      uShallow: { value: new Color(colors.shallow) },
      uFoam: { value: new Color('#F4F4F8') },
      uFogGrey: { value: FOG_GREY },
    },
    vertexShader: /* glsl */ `
      attribute float aFog;
      varying float vFog;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vFog = aFog;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStill;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uFogGrey;
      varying float vFog;
      varying vec2 vUv;
      varying vec3 vWorld;
      ${FOG_GLSL}
      void main() {
        float live = (1.0 - vFog) * (1.0 - uStill);
        float t = uTime * live;
        vec2 p = vWorld.xz;
        float w1 = sin(p.x * 7.0 + t * 1.3 * 6.283 * 0.25 + sin(p.y * 4.0));
        float w2 = sin(p.y * 9.0 - t * 0.8 * 6.283 * 0.25 + sin(p.x * 3.0));
        float wob = 0.5 + 0.25 * (w1 + w2);
        vec3 col = mix(uDeep, uShallow, wob);
        float spark = pow(max(0.0, sin(p.x * 31.0 + t * 1.9 + sin(p.y * 7.0)) * sin(p.y * 27.0 - t * 1.4 + sin(p.x * 5.0))), 40.0) * 0.5 * (1.0 - vFog);
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 3.0) * 0.3;
        col = mix(col, uFoam, fres) + spark;
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float foam = smoothstep(0.1, 0.0, edge + 0.02 * (w1 * w2)) * 0.75;
        col = mix(col, uFoam, foam);
        col = fogTint(col, vFog);
        gl_FragColor = vec4(col, 0.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Waterfalls (T45.1): the board.glb sheets down the Ganga risers and over the sides at the sea channel's ends. The
 * vertex colour runs light at the lip to foam at the foot; streaks slide down in world y, still under reduced motion.
 */
export function waterfallMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexColors: true,
    uniforms: { uTime: sharedTime, uStill: sharedStill, uFoam: { value: new Color('#F4F4F8') } },
    vertexShader: /* glsl */ `
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        vColor = color.rgb;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStill;
      uniform vec3 uFoam;
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        float t = uTime * (1.0 - uStill);
        float across = (vWorld.x + vWorld.z) * 34.0;
        float lane = fract(sin(floor(across) * 12.9898) * 43758.5453);
        float line = 1.0 - abs(fract(across) - 0.5) * 2.0;
        float flow = fract(vWorld.y * 2.2 + t * (0.7 + 0.6 * lane) + lane * 7.0);
        float streak = smoothstep(0.35, 0.95, line) * smoothstep(0.0, 0.2, flow) * smoothstep(0.9, 0.4, flow);
        vec3 col = mix(vColor, uFoam, streak * 0.5);
        gl_FragColor = vec4(col, 0.82);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Chip billboards: one quad per square, always facing the camera and upright, scaled with distance. */
export function chipMaterial(atlas: Texture): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uAtlas: { value: atlas } },
    vertexShader: /* glsl */ `
      attribute vec2 aOrigin;
      varying vec2 vUv;
      void main() {
        vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scale = clamp(-centre.z / 10.0, 1.0, 2.5);
        centre.xy += position.xy * scale;
        vUv = aOrigin + uv / ${ATLAS_GRID.toFixed(1)};
        gl_Position = projectionMatrix * centre;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uAtlas, vUv);
        if (texel.a < 0.02) discard;
        gl_FragColor = texel;
        #include <colorspace_fragment>
      }
    `,
  });
}

/**
 * Stage plaque billboards (T46.5): the chip shader's distance scale, but the quad is pinned by the edge `aAlign`
 * names (x: -1 left edge, 0 centre, 1 right edge; y: -1 bottom, 1 top) so a plate hangs outward from the board's
 * edge, and `aDim` tarnishes the plate of a stage no token has reached yet (still readable: not a spoiler).
 */
export function plaqueMaterial(atlas: Texture): ShaderMaterial {
  const cellV = (PLAQUE_CELL_HEIGHT / PLAQUE_ATLAS_SIZE).toFixed(6);
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uAtlas: { value: atlas } },
    vertexShader: /* glsl */ `
      attribute vec2 aOrigin;
      attribute vec2 aAlign;
      attribute float aDim;
      varying vec2 vUv;
      varying float vDim;
      void main() {
        vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // grows faster with distance than a chip, so a name still reads at Fit on a phone
        float scale = clamp(-centre.z / 6.5, 1.0, 4.2);
        vec2 local = position.xy - aAlign * vec2(${PLAQUE_WIDTH.toFixed(3)}, ${PLAQUE_HEIGHT.toFixed(3)}) * 0.5;
        // pulled 1.6 units toward the eye along its sight line (same place and size on screen), so the slab edge the
        // plate hangs beside never cuts it; a hero standing in front of it still does
        float dist = length(centre.xyz);
        float pulled = 1.0 - min(1.6, 0.3 * dist) / dist;
        centre.xyz *= pulled;
        centre.xy += local * scale * pulled;
        vUv = aOrigin + uv * vec2(1.0, ${cellV});
        vDim = aDim;
        gl_Position = projectionMatrix * centre;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      varying vec2 vUv;
      varying float vDim;
      void main() {
        vec4 texel = texture2D(uAtlas, vUv);
        if (texel.a < 0.02) discard;
        // an unreached stage: the brass tarnished (less gold, a little darker), the lettering as crisp as ever
        float luma = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
        vec3 rgb = mix(texel.rgb, vec3(luma), 0.45 * vDim) * (1.0 - 0.18 * vDim);
        gl_FragColor = vec4(rgb, texel.a);
        #include <colorspace_fragment>
      }
    `,
  });
}
