// node gen.mjs <public/assets root>
import { writeTokens } from './tokens.mjs';
import { writeSnakes } from './snakes.mjs';
import { writeLadders } from './ladders.mjs';
import { writeBoard } from './board.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node gen.mjs <assets root>');
const sizes = { ...writeBoard(root), ...writeTokens(root), ...writeSnakes(root), ...writeLadders(root) };
for (const [f, n] of Object.entries(sizes)) console.log(`${(n / 1024).toFixed(1).padStart(6)} KB  ${f}`);
