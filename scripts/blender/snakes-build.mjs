// Builds the snake GLBs (scripts/blender/snakes.py, headless Blender), then drops their rest-pose animation channels
// (prune-anim.mjs: the export keeps static channels so held poses survive; about 45 KB of glTF JSON each) and
// records the pruned sizes in the manifest.
//   npm run blender:snakes [-- id ...]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pruneGlb } from './prune-anim.mjs';

const OUT_DIR = 'public/models/snakes';
const MANIFEST = 'src/app/board3d/snakesManifest.json';
const only = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  ['scripts/blender/run.mjs', 'scripts/blender/snakes.py', OUT_DIR, MANIFEST, ...only],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status ?? 1);

// the manifest is Blender's (Python json): patch each snake's "bytes" in place rather than re-serialise it
let text = readFileSync(MANIFEST, 'utf8');
for (const id of Object.keys(JSON.parse(text).snakes)) {
  if (only.length > 0 && !only.includes(id)) continue;
  const pruned = await pruneGlb(`${OUT_DIR}/${id}.glb`);
  const entry = text.indexOf(`"${id}": {`);
  const at = text.indexOf('"bytes": ', entry);
  const end = text.slice(at).search(/[,\n]/);
  text = text.slice(0, at) + `"bytes": ${pruned.after}` + text.slice(at + end);
  console.log(`${id}: pruned ${pruned.dropped} rest-pose channels, ${pruned.before} -> ${pruned.after} bytes`);
}
writeFileSync(MANIFEST, text);
