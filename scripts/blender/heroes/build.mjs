// Builds every hero script in this folder (hanuman.py now; rama.py, sita.py, lakshmana.py later):
//   node scripts/blender/heroes/build.mjs [name ...]      ->  public/models/heroes/<name>.glb
// common.py and motion.py are shared modules, not heroes.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SHARED = new Set(['common', 'motion']);
const requested = process.argv.slice(2);
const heroes = readdirSync(here)
  .filter((f) => f.endsWith('.py'))
  .map((f) => f.slice(0, -3))
  .filter((name) => !SHARED.has(name) && (requested.length === 0 || requested.includes(name)));

if (heroes.length === 0) {
  console.error('no hero scripts found');
  process.exit(1);
}
for (const name of heroes) {
  console.log(`== ${name}`);
  const result = spawnSync(
    process.execPath,
    [join(here, '..', 'run.mjs'), join(here, `${name}.py`), `public/models/heroes/${name}.glb`],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
