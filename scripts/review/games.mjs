// Full 4-bot games to the Win screen on a running build, with every console and page error collected.
//   node scripts/review/games.mjs <baseUrl> <level:speed[:rm],...>
// e.g. easy:normal,hard:normal,easy:fast,hard:fast,easy:fast:rm   (rm = prefers-reduced-motion: reduce)
import { launch, openApp, startGame } from './lib.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const RUNS = (process.argv[3] ?? 'easy:normal,hard:normal,easy:fast,hard:fast,easy:fast:rm').split(',');
const BOTS = ['hanuman', 'rama', 'sita', 'lakshmana'].map((hero) => ({
  hero,
  controller: 'bot',
  name: hero[0].toUpperCase() + hero.slice(1),
}));

const browser = await launch();
const rows = [];
for (const run of RUNS) {
  const [level, speed, rm] = run.split(':');
  const { page, problems, context } = await openApp(browser, BASE, { reducedMotion: rm === 'rm' });
  const t0 = Date.now();
  await startGame(page, { level, players: BOTS, fast: speed === 'fast' });
  await page.waitForFunction(() => window.__app.state().winShown, null, { timeout: 1_800_000, polling: 500 });
  const seconds = (Date.now() - t0 - 2500) / 1000; // startGame waits 2.5 s after the board is up
  const state = await page.evaluate(() => window.__app.state());
  const winner = state.game.players.find((p) => p.rank === 1)?.name ?? '?';
  const row = {
    level,
    speed,
    reducedMotion: rm === 'rm',
    winner,
    seconds: Math.round(seconds),
    errors: problems.length,
  };
  rows.push({ ...row, problems });
  console.log(JSON.stringify(row));
  await context.close();
}
await browser.close();
const bad = rows.filter((r) => r.errors > 0);
for (const r of bad) console.log(`${r.level}:${r.speed}: ${r.problems.join('\n')}`);
console.log(bad.length ? 'GAMES HAD ERRORS' : 'ALL GAMES CLEAN');
process.exitCode = bad.length ? 1 : 0;
