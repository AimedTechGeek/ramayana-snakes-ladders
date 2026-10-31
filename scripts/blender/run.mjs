// Runs a Blender Python script headless: node scripts/blender/run.mjs <script.py> [script args...]
// Blender is found via $BLENDER or the default Windows install path.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const DEFAULT_BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const blender = process.env.BLENDER ?? DEFAULT_BLENDER;
const [script, ...scriptArgs] = process.argv.slice(2);

if (!script) {
  console.error('usage: node scripts/blender/run.mjs <script.py> [args...]');
  process.exit(2);
}
if (!existsSync(blender)) {
  console.error(`Blender not found at ${blender}. Set the BLENDER environment variable.`);
  process.exit(1);
}

const result = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python', script, '--', ...scriptArgs],
  {
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
