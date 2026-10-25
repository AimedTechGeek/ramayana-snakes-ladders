// node check.mjs <assets root>: well-formedness (tag balance, quoted attrs), banned features, palette-only colours, size.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { P, shade, tint } from './common.mjs';

const root = process.argv[2];
const allowed = new Set();
for (const v of Object.values(P)) {
  allowed.add(v.toUpperCase());
  allowed.add(shade(v).toUpperCase());
  allowed.add(tint(v).toUpperCase());
  allowed.add(shade(shade(v)).toUpperCase());
}
const BANNED = [
  /<text\b/i,
  /<filter\b/i,
  /Gradient/i,
  /font/i,
  /href="http/i,
  /url\(/i,
  /<image\b/i,
  /<script\b/i,
  /<style\b/i,
];

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.svg')) out.push(p);
  }
  return out;
}

let fail = 0;
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  const problems = [];
  const body = src.replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  // tag balance
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)([^<>]*?)(\/?)>/g;
  let m;
  let consumed = 0;
  while ((m = re.exec(body))) {
    const between = body.slice(consumed, m.index);
    if (between.includes('<') || between.includes('>')) problems.push(`stray <> near offset ${consumed}`);
    consumed = m.index + m[0].length;
    const [, close, name, attrs, selfClose] = m;
    if (close) {
      if (stack.pop() !== name) problems.push(`mismatched </${name}>`);
      continue;
    }
    if ((attrs.match(/"/g) || []).length % 2) problems.push(`odd quotes in <${name}${attrs.slice(0, 40)}>`);
    if (/=\s*[^"\s>]/.test(attrs)) problems.push(`unquoted attr in <${name}${attrs.slice(0, 40)}>`);
    const names = [...attrs.matchAll(/([\w:-]+)\s*=\s*"/g)].map((a) => a[1]);
    if (new Set(names).size !== names.length)
      problems.push(`duplicate attribute in <${name}${attrs.slice(0, 60)}>`);
    if (!selfClose) stack.push(name);
  }
  if (stack.length) problems.push(`unclosed: ${stack.join(',')}`);
  if (body.slice(consumed).includes('<')) problems.push('trailing junk');
  for (const b of BANNED) if (b.test(body)) problems.push(`banned feature ${b}`);
  for (const hex of body.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    if (!allowed.has(hex.toUpperCase())) problems.push(`off-palette colour ${hex}`);
  }
  if (/\bNaN\b|undefined/.test(body)) problems.push('NaN/undefined in output');
  const kb = src.length / 1024;
  if (kb > 40) problems.push(`too big: ${kb.toFixed(1)} KB`);
  const rel = file.slice(root.length + 1).replace(/\\/g, '/');
  if (problems.length) {
    fail++;
    console.log(`FAIL ${rel}: ${[...new Set(problems)].join('; ')}`);
  } else console.log(`ok   ${rel} (${kb.toFixed(1)} KB)`);
}
for (const j of ['snakes/palette.json', 'ladders/palette.json']) {
  try {
    const o = JSON.parse(readFileSync(join(root, j), 'utf8'));
    console.log(`ok   ${j} (${Object.keys(o).length} entries)`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${j}: ${e.message}`);
  }
}
process.exitCode = fail ? 1 : 0;
