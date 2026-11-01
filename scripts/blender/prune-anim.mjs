// Drops the animation channels that hold a bone at its rest transform for a whole clip, in place.
//   node scripts/blender/prune-anim.mjs <file.glb ...>
//
// The heroes export with Blender's "keep static channels" on: without it the exporter also drops channels that are
// constant but NOT at rest (Rama's held bow arm, Lakshmana's idle bow hand), and those poses snap back to rest. Kept,
// every bone gets a channel in every clip and the glTF JSON grows by ~170 KB per hero. A channel constant at the
// node's rest value is redundant for three.js (the mixer falls back to the node's original state), so this removes
// exactly those, then compacts accessors, buffer views and the binary chunk. Meshopt-compressed data is decoded only
// to be inspected; kept data is copied byte for byte.
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Below these a held channel is the rest pose up to Blender's sampling noise (translation 2e-4, scale 2e-5 seen):
// 5e-4 model units is under 0.001 mm at board scale, a quaternion component of 1e-3 about 0.1 degree.
const EPS = { translation: 5e-4, rotation: 1e-3, scale: 1e-4 };
const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const READ = {
  5126: { size: 4, get: (v, o) => v.getFloat32(o, true) },
  5122: { size: 2, get: (v, o) => Math.max(-1, v.getInt16(o, true) / 32767) },
  5123: { size: 2, get: (v, o) => v.getUint16(o, true) / 65535 },
  5120: { size: 1, get: (v, o) => Math.max(-1, v.getInt8(o) / 127) },
  5121: { size: 1, get: (v, o) => v.getUint8(o) / 255 },
};

function parseGlb(file) {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(file.subarray(20, 20 + jsonLength)));
  const binStart = 20 + jsonLength;
  const binLength = view.getUint32(binStart, true);
  return { json, bin: file.subarray(binStart + 8, binStart + 8 + binLength) };
}

function writeGlb(json, bin) {
  const pad = (data, fill) => {
    const out = new Uint8Array(data.length + ((4 - (data.length % 4)) % 4)).fill(fill);
    out.set(data);
    return out;
  };
  const jsonChunk = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binChunk = pad(bin, 0);
  const glb = new Uint8Array(28 + jsonChunk.length + binChunk.length);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, glb.length, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonChunk, 20);
  view.setUint32(20 + jsonChunk.length, binChunk.length, true);
  view.setUint32(24 + jsonChunk.length, 0x004e4942, true);
  glb.set(binChunk, 28 + jsonChunk.length);
  return glb;
}

/** The accessor's values as floats (normalized integers scaled), decoding meshopt if the view is compressed. */
function readAccessor(json, bin, index) {
  const accessor = json.accessors[index];
  const bufferView = json.bufferViews[accessor.bufferView];
  const reader = READ[accessor.componentType];
  if (!reader || accessor.sparse) return null;
  const width = COMPONENTS[accessor.type];
  const ext = bufferView.extensions?.EXT_meshopt_compression;
  let bytes;
  let stride;
  if (ext) {
    if (ext.buffer !== 0) return null;
    stride = ext.byteStride;
    bytes = new Uint8Array(ext.count * stride);
    const source = bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength);
    MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, stride, source, ext.mode, ext.filter ?? 'NONE');
  } else {
    if (bufferView.buffer !== 0) return null;
    stride = bufferView.byteStride ?? width * reader.size;
    bytes = bin.subarray(bufferView.byteOffset ?? 0, (bufferView.byteOffset ?? 0) + bufferView.byteLength);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const base = ext ? (accessor.byteOffset ?? 0) : (accessor.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const row = [];
    for (let c = 0; c < width; c++) row.push(reader.get(view, base + i * stride + c * reader.size));
    out.push(row);
  }
  return out;
}

function atRest(json, bin, channel, sampler) {
  const path = channel.target.path;
  if (sampler.interpolation === 'CUBICSPLINE' || !(path in REST)) return false;
  const values = readAccessor(json, bin, sampler.output);
  if (!values) return false;
  const node = json.nodes[channel.target.node];
  const rest = node[path] ?? REST[path];
  return values.every((row) => {
    const same = row.every((x, c) => Math.abs(x - rest[c]) <= EPS[path]);
    if (same || path !== 'rotation') return same;
    return row.every((x, c) => Math.abs(-x - rest[c]) <= EPS[path]); // q and -q are the same rotation
  });
}

export async function pruneGlb(path) {
  await MeshoptDecoder.ready;
  const before = readFileSync(path);
  const { json, bin } = parseGlb(before);
  let dropped = 0;
  for (const animation of json.animations ?? []) {
    const keep = animation.channels.filter((channel) => {
      const redundant = atRest(json, bin, channel, animation.samplers[channel.sampler]);
      if (redundant) dropped++;
      return !redundant;
    });
    const samplerMap = new Map();
    const samplers = [];
    for (const channel of keep) {
      if (!samplerMap.has(channel.sampler)) {
        samplerMap.set(channel.sampler, samplers.length);
        samplers.push(animation.samplers[channel.sampler]);
      }
      channel.sampler = samplerMap.get(channel.sampler);
    }
    animation.channels = keep;
    animation.samplers = samplers;
  }
  if (dropped === 0) return { path, dropped, before: before.length, after: before.length };

  // accessors still referenced, renumbered in their original order
  const usedAccessors = new Set();
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives) {
      Object.values(primitive.attributes).forEach((a) => usedAccessors.add(a));
      if (primitive.indices !== undefined) usedAccessors.add(primitive.indices);
      for (const target of primitive.targets ?? [])
        Object.values(target).forEach((a) => usedAccessors.add(a));
    }
  for (const skin of json.skins ?? [])
    if (skin.inverseBindMatrices !== undefined) usedAccessors.add(skin.inverseBindMatrices);
  for (const animation of json.animations ?? [])
    for (const sampler of animation.samplers) usedAccessors.add(sampler.input).add(sampler.output);
  const accessorMap = new Map();
  json.accessors = json.accessors.filter((accessor, i) => {
    if (!usedAccessors.has(i)) return false;
    accessorMap.set(i, accessorMap.size);
    return true;
  });
  const remapAccessor = (i) => accessorMap.get(i);
  for (const mesh of json.meshes ?? [])
    for (const primitive of mesh.primitives) {
      for (const key of Object.keys(primitive.attributes))
        primitive.attributes[key] = remapAccessor(primitive.attributes[key]);
      if (primitive.indices !== undefined) primitive.indices = remapAccessor(primitive.indices);
      for (const target of primitive.targets ?? [])
        for (const key of Object.keys(target)) target[key] = remapAccessor(target[key]);
    }
  for (const skin of json.skins ?? [])
    if (skin.inverseBindMatrices !== undefined)
      skin.inverseBindMatrices = remapAccessor(skin.inverseBindMatrices);
  for (const animation of json.animations ?? [])
    for (const sampler of animation.samplers) {
      sampler.input = remapAccessor(sampler.input);
      sampler.output = remapAccessor(sampler.output);
    }

  // buffer views still referenced; the binary chunk (buffer 0) is rebuilt from their bytes only
  const usedViews = new Set();
  for (const accessor of json.accessors)
    if (accessor.bufferView !== undefined) usedViews.add(accessor.bufferView);
  for (const image of json.images ?? []) if (image.bufferView !== undefined) usedViews.add(image.bufferView);
  const viewMap = new Map();
  const chunks = [];
  let offset = 0;
  const place = (start, length) => {
    const at = offset;
    chunks.push(bin.subarray(start, start + length));
    offset += length;
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(new Uint8Array(padding));
      offset += padding;
    }
    return at;
  };
  json.bufferViews = json.bufferViews.filter((bufferView, i) => {
    if (!usedViews.has(i)) return false;
    viewMap.set(i, viewMap.size);
    const ext = bufferView.extensions?.EXT_meshopt_compression;
    if (ext && ext.buffer === 0) ext.byteOffset = place(ext.byteOffset, ext.byteLength);
    else if (bufferView.buffer === 0)
      bufferView.byteOffset = place(bufferView.byteOffset ?? 0, bufferView.byteLength);
    return true;
  });
  for (const accessor of json.accessors)
    if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
  for (const image of json.images ?? [])
    if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
  const newBin = new Uint8Array(offset);
  let at = 0;
  for (const chunk of chunks) {
    newBin.set(chunk, at);
    at += chunk.length;
  }
  json.buffers[0].byteLength = newBin.length;
  const after = writeGlb(json, newBin);
  writeFileSync(path, after);
  return { path, dropped, before: before.length, after: after.length };
}

if (process.argv[1]?.endsWith('prune-anim.mjs')) {
  for (const path of process.argv.slice(2)) {
    const { dropped, before, after } = await pruneGlb(path);
    console.log(`${path}: dropped ${dropped} rest-pose channels, ${before} -> ${after} bytes`);
  }
}
