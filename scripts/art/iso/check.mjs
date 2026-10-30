// node check.mjs [dir...] (npm run art:iso:check): checks every SVG under public/assets/iso and art-src/iso, the figurine sources (T40 spec section 8).
//   - well formed (tag balance, quoted attributes, no NaN/undefined) and standalone light with vector-effect none
//   - file size under 300 KB
//   - every texture line ends on a stroke, a dot or an outline (the anatomy line-end check, run in headless Edge);
//     lines marked data-free are exempt
// The old 2D checker (scripts/art/check.mjs) skips iso/: these files use <style> and off-palette greys on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { chromium } from 'playwright-core';
import { LINE_ENDS } from '../anatomy/line-ends.mjs';

const MAX_KB = 300;
const roots = process.argv.length > 2 ? process.argv.slice(2) : ['public/assets/iso', 'art-src/iso'];

function svgFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) svgFiles(path, out);
    else if (name.endsWith('.svg')) out.push(path);
  }
  return out;
}

/** Structural problems of one SVG text. */
function structureProblems(svg) {
  const problems = [];
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/, '<style/>');
  const stack = [];
  const tags = /<(\/?)([A-Za-z][\w:-]*)([^<>]*?)(\/?)>/g;
  let consumed = 0;
  for (let m = tags.exec(body); m; m = tags.exec(body)) {
    const between = body.slice(consumed, m.index);
    if (between.includes('<') || between.includes('>')) problems.push(`stray <> near offset ${consumed}`);
    consumed = m.index + m[0].length;
    const [, close, name, attrs, selfClose] = m;
    if (close) {
      if (stack.pop() !== name) problems.push(`mismatched </${name}>`);
      continue;
    }
    if ((attrs.match(/"/g) ?? []).length % 2) problems.push(`odd quotes in <${name}>`);
    const names = [...attrs.matchAll(/([\w:-]+)\s*=\s*"/g)].map((a) => a[1]);
    if (new Set(names).size !== names.length) problems.push(`duplicate attribute in <${name}>`);
    if (!selfClose) stack.push(name);
  }
  if (stack.length) problems.push(`unclosed: ${stack.join(',')}`);
  if (body.slice(consumed).trim()) problems.push('trailing junk');
  if (/\bNaN\b|undefined/.test(body)) problems.push('NaN/undefined in output');
  if (!svg.includes('data-theme="light"')) problems.push('not a standalone light export');
  if (!svg.includes('vector-effect:none')) problems.push('missing vector-effect:none rule');
  if (/<(script|image|foreignObject)\b/i.test(svg)) problems.push('banned element');
  return problems;
}

function viewBoxOf(svg) {
  const m = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  if (!m) throw new Error('no viewBox');
  return { width: Number(m[1]), height: Number(m[2]) };
}

const files = roots.flatMap((root) => svgFiles(root).map((file) => ({ file, root })));
if (!files.length) {
  console.log(`FAIL no SVG files under ${roots.join(', ')}`);
  process.exit(1);
}

let failed = 0;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const { file, root } of files) {
    const svg = readFileSync(file, 'utf8');
    const name = relative(root, file).replace(/\\/g, '/');
    const problems = structureProblems(svg);
    const kb = Buffer.byteLength(svg) / 1024;
    if (kb >= MAX_KB) problems.push(`too big: ${kb.toFixed(1)} KB (limit ${MAX_KB})`);
    if (!problems.length) {
      const { width, height } = viewBoxOf(svg);
      const page = await browser.newPage({
        viewport: { width: Math.ceil(width * 2), height: Math.ceil(height * 2) },
      });
      await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
      const result = await page.evaluate(`(${LINE_ENDS})({})`);
      await page.close();
      if (!result) problems.push('line-end check did not run');
      else {
        for (const p of result.problems) {
          problems.push(
            `line end floats: ${p.what} ${p.end} at ${p.at.join(',')} gap ${p.gap?.toFixed(2) ?? 'n/a'} px`,
          );
        }
        console.log(`     ${name}: ${result.ends} ends on ${result.lines} lines`);
      }
    }
    if (problems.length) {
      failed++;
      console.log(`FAIL ${name}: ${[...new Set(problems)].join('; ')}`);
    } else console.log(`ok   ${name} (${kb.toFixed(1)} KB)`);
  }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
