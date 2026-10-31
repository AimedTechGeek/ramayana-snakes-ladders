// node gen.mjs <public/assets root>
import { writeTokens } from './tokens.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node gen.mjs <assets root>');
const sizes = writeTokens(root);
for (const [f, n] of Object.entries(sizes)) console.log(`${(n / 1024).toFixed(1).padStart(6)} KB  ${f}`);
